# C4 — Nível 2: Diagrama de Container

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                       DIAGRAMA DE CONTAINER (C4 — Nível 2)                  ║
╚═══════════════════════════════════════════════════════════════════════════════╝

  ┌──────────────┐          ┌──────────────┐
  │  👤 Usuário  │          │ 👤 Admin RH  │
  └──────┬───────┘          └──────┬───────┘
         │                         │
         │   HTTP / REST (JSON)    │
         └─────────────┬───────────┘
                       │
         ┌─────────────▼──────────────────────────────────────────────────────┐
         │              Employee Management System                            │
         │                                                                     │
         │  ┌──────────────────────────────────────────────────────────────┐  │
         │  │                    🟢 API Server                             │  │
         │  │              Node.js 18 + Express 4                          │  │
         │  │                                                               │  │
         │  │  • Expõe endpoints REST em /api/employees                    │  │
         │  │  • Expõe endpoints REST em /api/uploads                      │  │
         │  │  • Serve documentação Swagger em /api-docs                   │  │
         │  │  • Valida dados de entrada com Zod                           │  │
         │  │  • Processa multipart/form-data com Multer                   │  │
         │  │  • Pipeline de upload: indexação RAG + classificação LLM     │  │
         │  │  • Porta padrão: 3000                                        │  │
         │  └──────┬─────────────────────┬────────────────────┬────────────┘  │
         │         │                     │                    │                │
         │         ▼                     ▼                    ▼                │
         │  ┌─────────────┐   ┌──────────────────┐  ┌────────────────────┐   │
         │  │ 🗄️ SQLite   │   │  📁 File Storage  │  │  🤖 Ollama         │   │
         │  │ Database    │   │  Sistema de       │  │  (externo/local)   │   │
         │  │             │   │  Arquivos Local   │  │                    │   │
         │  │ • employees │   │                   │  │ nomic-embed-text   │   │
         │  │ • pdf_docs  │   │ ./uploads/pdfs/   │  │  → embeddings      │   │
         │  │ • pdf_tags  │   │  arquivos .pdf    │  │                    │   │
         │  │ • doc_chunks│   │  com nome único   │  │ llama3.2           │   │
         │  │             │   │                   │  │  → classificação   │   │
         │  │ WAL mode    │   │                   │  │    de documentos   │   │
         │  │ FK ON       │   │                   │  │                    │   │
         │  └─────────────┘   └──────────────────┘  └────────────────────┘   │
         └─────────────────────────────────────────────────────────────────────┘
```

## Containers

| Container           | Tecnologia             | Responsabilidade                                                                    |
|---------------------|------------------------|-------------------------------------------------------------------------------------|
| **API Server**      | Node.js + Express      | Processamento de requisições HTTP, validação, lógica de negócio, orquestração do pipeline RAG+LLM |
| **SQLite Database** | SQLite + better-sqlite3| Persistência relacional de funcionários, metadados de PDFs, tags e chunks de embeddings |
| **File Storage**    | Sistema de arquivos    | Armazenamento físico dos arquivos PDF enviados                                      |
| **Ollama**          | Servidor LLM local     | Gera embeddings via `nomic-embed-text` e classifica documentos via `llama3.2`       |

## Interfaces de Comunicação

| De             | Para              | Protocolo          | Dados                                          |
|----------------|-------------------|--------------------|------------------------------------------------|
| Usuário        | API Server        | HTTP/1.1 REST      | JSON, multipart/form-data                      |
| API Server     | SQLite Database   | Síncrono (driver)  | Queries SQL via better-sqlite3                 |
| API Server     | File Storage      | I/O de disco       | Leitura/escrita de arquivos .pdf               |
| API Server     | Ollama            | HTTP/1.1 (fetch)   | JSON — prompt/embedding request & response     |

## Fluxo de Upload (pipeline síncrono)

```
POST /api/uploads
      │
      ├─► Validação (mimetype, tamanho)
      │
      ├─► INSERT pdf_documents (status='processing')
      │
      ├─► RagService.indexDocument()
      │     ├─ Extrai texto do PDF (pdf-parse)
      │     ├─ Divide em chunks (500 chars, 80 overlap)
      │     └─ Embeds via Ollama → salva em document_chunks
      │
      ├─► RagService.autoLabel()
      │     ├─ Lê chunks do banco
      │     └─ Chama Ollama LLM → retorna tags + justificativa
      │
      ├─► UPDATE pdf_documents (status='ready') + INSERT pdf_tags
      │
      └─► Resposta 201 com documento + tags geradas
```

> Se qualquer etapa falhar, o registro é removido do banco e o arquivo é deletado do disco.
> O documento **nunca** fica disponível para listagem ou download com status `'processing'`.

## Decisões de Design

- **Pipeline síncrono no upload**: a análise pela LLM ocorre durante o POST, garantindo que qualquer documento retornado pela API já tenha tags definidas. Isso simplifica o cliente e elimina estados intermediários visíveis.
- **SQLite** foi escolhido por sua simplicidade operacional (zero configuração). Pode ser migrado para PostgreSQL alterando somente o `database.js`.
- **File Storage local** pode ser substituído por S3/GCS em produção alterando o `upload.service.js`.
- **Ollama local**: sem API keys, sem billing, sem dependência de rede externa. Pode ser substituído por qualquer LLM com API compatível.
- **Monolito modular**: embora seja um único container de API, os módulos são internamente desacoplados por camadas (Repository → Service → Controller).
