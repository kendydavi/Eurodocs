# C4 — Nível 3: Diagrama de Componente

```
╔═══════════════════════════════════════════════════════════════════════════════════╗
║                      DIAGRAMA DE COMPONENTE (C4 — Nível 3)                      ║
║                              [ API Server ]                                      ║
╚═══════════════════════════════════════════════════════════════════════════════════╝

  Cliente HTTP
  (Supertest / Browser / Postman)
         │
         │  HTTP Request
         ▼
  ┌──────────────────────────────────────────────────────────────────────────────┐
  │                              app.js  (Express)                              │
  │                                                                              │
  │   CORS Middleware  │  JSON Parser  │  URL Encoded Parser  │  Swagger UI     │
  │                                                                              │
  │  /api/employees ──────────────────────────────────────────────────────────┐ │
  │  /api/uploads   ────────────────────────────────────────────────────────┐ │ │
  │                                                                          │ │ │
  └──────────────────────────────────────────────────────────────────────────┼─┘ │
                                                                             │
         ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐    ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┐
         │   Módulo: Employees           │    │  Módulo: Uploads                     │
         │                               │    │                                       │
         │  ┌────────────────────────┐   │    │  ┌────────────────────────┐          │
         │  │  employee.routes.js    │   │    │  │  upload.routes.js      │          │
         │  │  (Swagger JSDoc +      │   │    │  │  (Swagger JSDoc +      │          │
         │  │   Express Router)      │   │    │  │   Multer middleware)   │          │
         │  └──────────┬─────────────┘   │    │  └──────────┬─────────────┘          │
         │             │                 │    │             │                          │
         │             ▼                 │    │             ▼                          │
         │  ┌────────────────────────┐   │    │  ┌────────────────────────┐          │
         │  │ employee.controller.js │   │    │  │  upload.controller.js  │          │
         │  │  list / getById /      │   │    │  │  list / getById /      │          │
         │  │  create / update /     │   │    │  │  upload / download /   │          │
         │  │  remove                │   │    │  │  remove / search       │          │
         │  └──────────┬─────────────┘   │    │  └──────────┬─────────────┘          │
         │             │                 │    │             │                          │
         │             ▼                 │    │             ▼                          │
         │  ┌────────────────────────┐   │    │  ┌─────────────────────────────────┐ │
         │  │  employee.service.js   │   │    │  │       upload.service.js         │ │
         │  │  • Validação (Zod)     │   │    │  │  • Validação mimetype/tamanho   │ │
         │  │  • Regras de negócio   │   │    │  │  • Orquestra pipeline de upload │ │
         │  │  • Unicidade email/CPF │   │    │  │    1. repo.create (processing)  │ │
         │  └──────────┬─────────────┘   │    │  │    2. rag.indexDocument()       │ │
         │             │                 │    │  │    3. rag.autoLabel()           │ │
         │             ▼                 │    │  │    4. repo.updateTagsAndStatus  │ │
         │  ┌────────────────────────┐   │    │  │  • Rollback em caso de falha    │ │
         │  │ employee.repository.js │   │    │  └──────────┬──────────────────────┘ │
         │  │  findAll / findById /  │   │    │             │                          │
         │  │  findByEmail/Cpf /     │   │    │    ┌────────┴────────┐                │
         │  │  create / update /     │   │    │    ▼                 ▼                │
         │  │  delete                │   │    │  ┌──────────────┐  ┌───────────────┐ │
         │  └──────────┬─────────────┘   │    │  │upload.repo.js│  │ rag.service.js│ │
         └ ─ ─ ─ ─ ─ ─│─ ─ ─ ─ ─ ─ ─ ─ ┘    │  │findAll(ready)│  │extractText()  │ │
                       │                       │  │findById()    │  │chunkText()    │ │
                       │                       │  │create()      │  │embedTexts()   │ │
                       │                       │  │updateTags    │  │indexDocument()│ │
                       │                       │  │AndStatus()   │  │searchChunks() │ │
                       │                       │  └──────┬───────┘  │autoLabel()    │ │
                       │                       │         │          └──────┬────────┘ │
                       │                       │         │                 │           │
                       │                       │         │     ┌───────────┘           │
                       │                       │         │     ▼                        │
                       │                       │         │  ┌────────────────────────┐ │
                       │                       │         │  │   rag.repository.js    │ │
                       │                       │         │  │  saveChunks()          │ │
                       │                       │         │  │  getAllChunks()         │ │
                       │                       │         │  │  deleteByDocument()    │ │
                       │                       │         │  │  isIndexed()           │ │
                       │                       │         │  └──────────┬─────────────┘ │
                       │                       └ ─ ─ ─ ─│─ ─ ─ ─ ─ ─ ─│─ ─ ─ ─ ─ ─ ─┘
                       │                                 │             │
                       │          ┌──────────────────────┘             │
                       ▼          ▼                                     ▼
              ┌──────────────────────────────────┐          ┌──────────────────────┐
              │          database.js             │          │   🤖 Ollama API      │
              │    getDatabase() / SQLite        │          │  (externo/local)     │
              │    runMigrations()               │          │                      │
              └───────────────┬──────────────────┘          │  /api/embeddings     │
                              │                             │  /api/generate       │
               ┌──────────────┴────────────┐               └──────────────────────┘
               ▼                           ▼
     ┌──────────────────┐       ┌──────────────────┐
     │  🗄️ SQLite DB    │       │  📁 File Storage  │
     │  employees       │       │  ./uploads/pdfs/  │
     │  pdf_documents   │       └──────────────────┘
     │  pdf_tags        │
     │  document_chunks │
     └──────────────────┘


  ┌──────────────────────────────────────────────┐
  │           Middleware Transversal             │
  │                                              │
  │  errorHandler.js  →  Centraliza tratamento  │
  │                       de erros e HTTP status │
  │                                              │
  │  notFound handler →  Responde 404 para       │
  │                       rotas inexistentes     │
  └──────────────────────────────────────────────┘
```

## Componentes

### Módulo Employees

| Componente                 | Responsabilidade                                                              |
|----------------------------|-------------------------------------------------------------------------------|
| `employee.routes.js`       | Define endpoints HTTP, aplica JSDoc para Swagger, registra handlers           |
| `employee.controller.js`   | Extrai parâmetros da requisição, chama o Service, formata resposta HTTP       |
| `employee.service.js`      | Valida dados com Zod, aplica regras de unicidade, orquestra o Repository      |
| `employee.repository.js`   | Executa queries SQL no SQLite, normaliza dados (boolean `active`)             |

### Módulo Uploads

| Componente                 | Responsabilidade                                                                                     |
|----------------------------|------------------------------------------------------------------------------------------------------|
| `upload.routes.js`         | Define endpoints HTTP, configura Multer (storage, fileFilter, limits)                               |
| `upload.controller.js`     | Extrai arquivo e campos do request, chama Service, responde com stream/JSON. Bloqueia download de documentos com `status != 'ready'` |
| `upload.service.js`        | Orquestra o pipeline completo: validação → indexação RAG → classificação LLM → persistência de tags → liberação do documento. Faz rollback em caso de falha |
| `upload.repository.js`     | Executa queries SQL; `findAll` filtra por `status='ready'`; `updateTagsAndStatus` persiste tags e muda o status |
| `rag.service.js`           | Extrai texto do PDF (`pdf-parse`), fragmenta em chunks com overlap, gera embeddings via Ollama, realiza busca por cosseno, classifica documentos via LLM |
| `rag.repository.js`        | Persiste e recupera chunks + embeddings da tabela `document_chunks`                                  |

### Infraestrutura Transversal

| Componente          | Responsabilidade                                                                         |
|---------------------|------------------------------------------------------------------------------------------|
| `database.js`       | Singleton de conexão SQLite, WAL mode, FK constraints, execução de migrations (inclui `document_chunks` e coluna `status` em `pdf_documents`) |
| `swagger.js`        | Define spec OpenAPI 3.0: schemas, servers, info. Lê JSDoc das rotas                     |
| `errorHandler.js`   | Handler de erro global: mapeia `err.status`, serializa erros de validação                |
| `app.js`            | Composição: registra middlewares, rotas, Swagger UI, inicia o servidor                   |

## Fluxo de uma Requisição (POST /api/uploads)

```
Request → app.js (middlewares) → upload.routes.js [Multer: salva arquivo]
        → upload.controller.js
        → upload.service.js
            ├─ Validação: mimetype PDF + tamanho
            ├─ upload.repository.create() → INSERT pdf_documents (status='processing')
            ├─ rag.service.indexDocument()
            │     ├─ Extrai texto (pdf-parse)
            │     ├─ Divide em chunks (500 chars, 80 overlap)
            │     ├─ Embed cada chunk via Ollama /api/embeddings
            │     └─ rag.repository.saveChunks() → INSERT document_chunks
            ├─ rag.service.autoLabel()
            │     ├─ rag.repository.getAllChunks()
            │     ├─ Chama Ollama /api/generate com contexto
            │     └─ Retorna { tags[], reason }
            ├─ upload.repository.updateTagsAndStatus()
            │     ├─ INSERT pdf_tags (tags LLM + tags manuais)
            │     └─ UPDATE pdf_documents SET status='ready'
            └─ Retorna documento completo
        → response 201 JSON (com tags geradas pela LLM)
```

**Em caso de falha após o INSERT inicial:**
```
        → upload.repository.delete(doc.id)  [remove registro do banco]
        → _cleanFile(filePath)              [remove arquivo do disco]
        → response 422 JSON com mensagem de erro
```

## Fluxo de uma Requisição (GET /api/uploads/:id/download)

```
Request → upload.routes.js → upload.controller.download
        → upload.service.getDocument(id)
        → Verificação: doc.status === 'ready' ?
            ├─ NÃO → response 404 "Documento não encontrado ou ainda em processamento"
            └─ SIM → res.download(filePath, originalName)
```

## Padrão Arquitetural

A arquitetura segue o padrão **Repository → Service → Controller (RSC)**:

- **Repository**: única camada que conhece o banco de dados. Pode ser trocada sem impacto no Service.
- **Service**: toda a lógica de negócio fica aqui, incluindo a orquestração do pipeline RAG+LLM. Testável de forma unitária com repositórios e serviços mockados.
- **Controller**: fina camada HTTP. Não contém lógica de negócio. Responsável apenas por bloquear acesso a documentos ainda em `status='processing'`.
