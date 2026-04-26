const fs  = require('fs');
const pdf = require('pdf-parse');
const RagRepository = require('./rag.repository');

const OLLAMA_URL    = process.env.OLLAMA_URL    || 'http://localhost:11434';
const EMBED_MODEL   = process.env.OLLAMA_EMBED_MODEL || 'nomic-embed-text';
const LABEL_MODEL   = process.env.OLLAMA_LABEL_MODEL || 'llama3.2';
const CHUNK_SIZE    = 500;
const CHUNK_OVERLAP = 80;
const TOP_K_CONTEXT = 6;

class RagService {
  constructor(ragRepo) {
    this.repo = ragRepo || new RagRepository();
  }

  async extractText(filePath) {
    const data = await pdf(fs.readFileSync(filePath));
    return data.text || '';
  }

  chunkText(text) {
    const chunks = [];
    let start    = 0;
    while (start < text.length) {
      const chunk = text.slice(start, Math.min(start + CHUNK_SIZE, text.length)).trim();
      if (chunk.length > 20) chunks.push(chunk);
      start += CHUNK_SIZE - CHUNK_OVERLAP;
    }
    return chunks;
  }

  async _embedOne(text) {
    const res = await fetch(`${OLLAMA_URL}/api/embeddings`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ model: EMBED_MODEL, prompt: text }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Ollama embedding error: ${err}`);
    }

    const data = await res.json();
    return data.embedding;
  }

  async embedTexts(texts) {
    const embeddings = [];
    for (const text of texts) {
      embeddings.push(await this._embedOne(text));
    }
    return embeddings;
  }

  async indexDocument(documentId, filePath) {
    const text   = await this.extractText(filePath);
    const chunks = this.chunkText(text);

    if (!chunks.length) {
      console.warn(`[RAG] No extractable text in document ${documentId}`);
      return 0;
    }

    const allEmbeddings = await this.embedTexts(chunks);

    const rows = chunks.map((content, i) => ({
      content,
      embedding: allEmbeddings[i],
    }));

    this.repo.deleteByDocument(documentId);
    this.repo.saveChunks(documentId, rows);

    console.log(`[RAG] Indexed ${rows.length} chunks for document ${documentId}`);
    return rows.length;
  }

  cosineSimilarity(a, b) {
    let dot = 0, magA = 0, magB = 0;
    for (let i = 0; i < a.length; i++) {
      dot  += a[i] * b[i];
      magA += a[i] * a[i];
      magB += b[i] * b[i];
    }
    return dot / (Math.sqrt(magA) * Math.sqrt(magB));
  }

  async searchChunks(documentId, queryText, topK = 5) {
    const [queryEmbedding] = await this.embedTexts([queryText]);
    return this.repo.getAllChunks(documentId)
      .map(c => ({
        content:     c.content,
        chunk_index: c.chunk_index,
        score:       this.cosineSimilarity(queryEmbedding, c.embedding),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  async autoLabel(documentId, availableTags) {
    const chunks = this.repo.getAllChunks(documentId);

    if (!chunks.length) {
      throw Object.assign(
        new Error('Documento ainda não foi indexado. Aguarde e tente novamente.'),
        { status: 422 }
      );
    }

    const context = chunks
      .slice(0, TOP_K_CONTEXT)
      .map(c => c.content)
      .join('\n\n---\n\n');

    const tagHint = availableTags.length
      ? `\n\nSuggested labels (use if they fit, otherwise create your own): ${availableTags.join(', ')}`
      : '';

    const res = await fetch(`${OLLAMA_URL}/api/generate`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model:  LABEL_MODEL,
        stream: false,
        prompt: `You are a document classifier. Read the excerpt and generate accurate tags that describe the document's actual content and topic.${tagHint}

Return ONLY a valid JSON object — no markdown, no extra text — in this exact shape:
{"tags": ["tag1", "tag2"], "reason": "brief justification in the same language as the document"}

Rules:
- Generate 1 to 4 short lowercase tags (single words or hyphenated, e.g. "nginx", "contrato", "folha-de-pagamento").
- Tags must reflect the REAL content of the document, not a forced category.
- If none of the suggested labels fit, invent appropriate ones.
- The "reason" field must be one concise sentence in the same language as the document.

Document excerpt:
${context}`,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Ollama generate error: ${err}`);
    }

    const data = await res.json();
    const raw  = data.response.trim().replace(/```json|```/g, '');
    const json = JSON.parse(raw);

    if (!Array.isArray(json.tags)) {
      throw new Error('Resposta inválida do modelo de IA');
    }

    json.tags = json.tags
      .map(t => String(t).toLowerCase().trim().replace(/\s+/g, '-'))
      .filter(Boolean)
      .slice(0, 4);

    return json;
  }
}

module.exports = RagService;
