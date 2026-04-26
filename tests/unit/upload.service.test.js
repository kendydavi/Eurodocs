const mockFs = {
  existsSync: jest.fn().mockReturnValue(true),
  unlinkSync:  jest.fn(),
  mkdirSync:   jest.fn(),
};
jest.mock('fs', () => mockFs);

jest.mock('../../src/config/database', () => ({
  getDatabase:   jest.fn(),
  closeDatabase: jest.fn(),
}));
jest.mock('../../src/modules/uploads/upload.repository');

const UploadRepository = require('../../src/modules/uploads/upload.repository');
const UploadService    = require('../../src/modules/uploads/upload.service');

function makeMockRepo(overrides = {}) {
  const instance = {
    findAll:  jest.fn().mockReturnValue({ data: [], total: 0, page: 1, limit: 10, pages: 0 }),
    findById: jest.fn().mockReturnValue(null),
    create:   jest.fn(),
    delete:   jest.fn().mockReturnValue(true),
    allTags:  jest.fn().mockReturnValue([]),
    ...overrides,
  };
  UploadRepository.mockImplementation(() => instance);
  return instance;
}

const fakeFile = (overrides = {}) => ({
  path:         '/tmp/uploads/test.pdf',
  originalname: 'documento.pdf',
  mimetype:     'application/pdf',
  size:         1024,
  ...overrides,
});

const existingDoc = (tags = []) => ({
  id: 1, filename: 'doc_123.pdf', original_name: 'doc.pdf',
  mimetype: 'application/pdf', size: 1024, employee_id: null, tags,
});

describe('UploadService', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('listDocuments', () => {
    it('delegates filters (including tags) to repository', async () => {
      const repo = makeMockRepo();
      const svc  = new UploadService(repo);
      await svc.listDocuments({ page: 1, limit: 5, tags: ['rh', 'contrato'] });
      expect(repo.findAll).toHaveBeenCalledWith({ page: 1, limit: 5, tags: ['rh', 'contrato'] });
    });
  });

  describe('getDocument', () => {
    it('returns document when found', async () => {
      const doc  = existingDoc();
      const repo = makeMockRepo({ findById: jest.fn().mockReturnValue(doc) });
      const svc  = new UploadService(repo);
      await expect(svc.getDocument(1)).resolves.toEqual(doc);
    });

    it('throws 404 when not found', async () => {
      const svc = new UploadService(makeMockRepo());
      await expect(svc.getDocument(99)).rejects.toMatchObject({ status: 404 });
    });
  });

  describe('uploadDocument', () => {
    it('saves valid PDF and returns document record', async () => {
      const doc  = existingDoc(['contrato']);
      const repo = makeMockRepo({ create: jest.fn().mockReturnValue(doc) });
      const svc  = new UploadService(repo);
      const result = await svc.uploadDocument({
        file: fakeFile(), description: 'Contrato', tags: ['contrato'],
      });
      expect(result).toEqual(doc);
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ tags: ['contrato'] })
      );
    });

    it('parses comma-separated tags string', async () => {
      const doc  = existingDoc(['rh', 'financeiro']);
      const repo = makeMockRepo({ create: jest.fn().mockReturnValue(doc) });
      const svc  = new UploadService(repo);
      await svc.uploadDocument({ file: fakeFile(), tags: 'rh, financeiro' });
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ tags: ['rh', 'financeiro'] })
      );
    });

    it('defaults to empty tags when none provided', async () => {
      const doc  = existingDoc([]);
      const repo = makeMockRepo({ create: jest.fn().mockReturnValue(doc) });
      const svc  = new UploadService(repo);
      await svc.uploadDocument({ file: fakeFile() });
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ tags: [] })
      );
    });

    it('throws 400 when no file is provided', async () => {
      const svc = new UploadService(makeMockRepo());
      await expect(svc.uploadDocument({ file: null })).rejects.toMatchObject({ status: 400 });
    });

    it('throws 400 for non-PDF mimetype', async () => {
      const svc = new UploadService(makeMockRepo());
      await expect(svc.uploadDocument({ file: fakeFile({ mimetype: 'image/jpeg' }) }))
        .rejects.toMatchObject({ status: 400 });
    });

    it('throws 400 when file exceeds size limit', async () => {
      const svc = new UploadService(makeMockRepo());
      await expect(svc.uploadDocument({ file: fakeFile({ size: 999 * 1024 * 1024 }) }))
        .rejects.toMatchObject({ status: 400 });
    });

    it('links document to employee when employee_id provided', async () => {
      const doc  = { ...existingDoc(), employee_id: 5 };
      const repo = makeMockRepo({ create: jest.fn().mockReturnValue(doc) });
      const svc  = new UploadService(repo);
      await svc.uploadDocument({ file: fakeFile(), employee_id: '5' });
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ employee_id: 5 })
      );
    });
  });

  describe('deleteDocument', () => {
    it('deletes record and cleans up file', async () => {
      const doc  = existingDoc();
      const repo = makeMockRepo({ findById: jest.fn().mockReturnValue(doc) });
      const svc  = new UploadService(repo);
      await svc.deleteDocument(1);
      expect(repo.delete).toHaveBeenCalledWith(1);
      expect(mockFs.unlinkSync).toHaveBeenCalled();
    });

    it('throws 404 for non-existent document', async () => {
      const svc = new UploadService(makeMockRepo());
      await expect(svc.deleteDocument(99)).rejects.toMatchObject({ status: 404 });
    });
  });

  describe('getAllTags', () => {
    it('returns tag list from repository', async () => {
      const repo = makeMockRepo({ allTags: jest.fn().mockReturnValue(['contrato', 'rh']) });
      const svc  = new UploadService(repo);
      await expect(svc.getAllTags()).resolves.toEqual(['contrato', 'rh']);
    });
  });

  describe('getFilePath', () => {
    it('returns path containing filename', () => {
      const svc = new UploadService(makeMockRepo());
      expect(svc.getFilePath('doc_123.pdf')).toContain('doc_123.pdf');
    });
  });
});
