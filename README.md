# API de Gestão de Funcionários

API RESTful para **cadastro de funcionários** e **upload de documentos PDF**, construída com Node.js, Express e SQLite. Documentos PDF são automaticamente indexados via RAG e classificados por uma LLM local (Ollama) antes de ficarem disponíveis para download.

---

## Sumário

- [Tecnologias](#tecnologias)
- [Estrutura do Projeto](#estrutura-do-projeto)
- [Requisitos](#requisitos)
- [Instalação e Execução](#instalação-e-execução)
- [Variáveis de Ambiente](#variáveis-de-ambiente)
- [Módulos](#módulos)
- [Documentação da API (Swagger)](#documentação-da-api-swagger)
- [Banco de Dados](#banco-de-dados)
- [Testes](#testes)
- [Integração RAG (v2.0.0)](#integração-rag-v200)
- [Diagrama C4](#diagrama-c4)

---

## Tecnologias

| Camada         | Tecnologia                        |
|----------------|-----------------------------------|
| Runtime        | Node.js 18+                       |
| Framework      | Express 4                         |
| Banco de dados | SQLite via `better-sqlite3`       |
| Validação      | Zod                               |
| Upload         | Multer                            |
| LLM / RAG      | Ollama (`nomic-embed-text` + `llama3.2`) |
| Extração PDF   | pdf-parse                         |
| Docs           | Swagger UI + swagger-jsdoc        |
| Testes         | Jest + Supertest                  |

---

## Estrutura do Projeto

```
.
├── src/
│   ├── app.js                          # Entry point + configuração Express
│   ├── config/
│   │   ├── database.js                 # Conexão SQLite + migrações
│   │   └── swagger.js                  # Configuração OpenAPI 3.0
│   ├── middleware/
│   │   └── errorHandler.js             # Handler de erros global
│   └── modules/
│       ├── employees/
│       │   ├── employee.repository.js  # Acesso ao banco
│       │   ├── employee.service.js     # Regras de negócio
│       │   ├── employee.controller.js  # Controlador HTTP
│       │   └── employee.routes.js      # Rotas + JSDoc Swagger
│       └── uploads/
│           ├── upload.repository.js    # Acesso ao banco (filtra por status)
│           ├── upload.service.js       # Orquestra pipeline: RAG + LLM + tags
│           ├── upload.controller.js    # Controlador HTTP
│           ├── upload.routes.js        # Rotas + JSDoc Swagger
│           ├── rag.service.js          # Extração, chunking, embeddings, busca, auto-label
│           └── rag.repository.js       # Persistência de chunks no banco
├── tests/
│   ├── unit/
│   │   ├── employee.service.test.js    # Testes unitários do serviço de funcionários
│   │   └── upload.service.test.js      # Testes unitários do serviço de upload
│   └── integration/
│       ├── testDb.js                   # SQLite in-memory para testes
│       ├── employee.routes.test.js     # Testes E2E das rotas de funcionários
│       └── upload.routes.test.js       # Testes E2E das rotas de upload
├── uploads/
│   └── pdfs/                           # Arquivos enviados (gitignored)
├── docs/
│   └── c4/                             # Diagramas C4 (Contexto, Container, Componente)
├── .env.example
├── package.json
└── README.md
```

---

## Requisitos

- **Node.js** >= 18.x
- **npm** >= 9.x
- **Ollama** instalado e em execução (necessário para upload de PDFs)

> Não é necessário instalar nenhum banco de dados separado. O SQLite é embutido.

---

## Instalação e Execução

### 1. Clone o repositório

```bash
git clone https://github.com/sua-org/employee-management-api.git
cd employee-management-api
```

### 2. Instale as dependências

```bash
npm install
```

### 3. Configure o Ollama

Instale o Ollama: https://ollama.com

```bash
# Baixe os modelos necessários (~2,3 GB no total)
ollama pull nomic-embed-text   # ~270 MB — usado para embeddings
ollama pull llama3.2           # ~2 GB   — usado para classificação de documentos

# Inicie o servidor Ollama (mantenha em execução)
ollama serve
```

### 4. Configure as variáveis de ambiente

```bash
cp .env.example .env
# Edite o arquivo .env conforme necessário
```

### 5. Execute o projeto

```bash
# Desenvolvimento (com hot-reload)
npm run dev

# Produção
npm start
```

O servidor estará disponível em: **http://localhost:3000**

---

## Variáveis de Ambiente

| Variável               | Padrão                   | Descrição                                         |
|------------------------|--------------------------|---------------------------------------------------|
| `PORT`                 | `3000`                   | Porta do servidor HTTP                            |
| `NODE_ENV`             | `development`            | Ambiente (`development`, `production`, `test`)    |
| `DB_PATH`              | `./database.sqlite`      | Caminho do arquivo SQLite                         |
| `UPLOAD_DIR`           | `./uploads/pdfs`         | Diretório de armazenamento dos PDFs               |
| `MAX_FILE_SIZE_MB`     | `10`                     | Tamanho máximo de PDF em megabytes                |
| `OLLAMA_URL`           | `http://localhost:11434` | URL do servidor Ollama                            |
| `OLLAMA_EMBED_MODEL`   | `nomic-embed-text`       | Modelo usado para geração de embeddings           |
| `OLLAMA_LABEL_MODEL`   | `llama3.2`               | Modelo usado para classificação automática        |

---

## Módulos

### Módulo de Funcionários (`/api/employees`)

| Método   | Rota                  | Descrição                               |
|----------|-----------------------|-----------------------------------------|
| `GET`    | `/api/employees`      | Listar funcionários (paginado, filtros) |
| `GET`    | `/api/employees/:id`  | Buscar funcionário por ID               |
| `POST`   | `/api/employees`      | Cadastrar novo funcionário              |
| `PATCH`  | `/api/employees/:id`  | Atualizar funcionário parcialmente      |
| `DELETE` | `/api/employees/:id`  | Remover funcionário                     |

**Filtros disponíveis no `GET /api/employees`:**

| Query Param  | Tipo    | Descrição                    |
|--------------|---------|------------------------------|
| `page`       | integer | Página (padrão: 1)           |
| `limit`      | integer | Itens por página (máx: 100)  |
| `department` | string  | Filtrar por departamento     |
| `active`     | boolean | Filtrar por status           |
| `search`     | string  | Busca em nome, e-mail, cargo |

**Campos obrigatórios no cadastro:**

```json
{
  "name":       "João Silva",
  "email":      "joao@empresa.com",
  "cpf":        "123.456.789-00",
  "department": "Tecnologia",
  "role":       "Desenvolvedor",
  "salary":     8500.00,
  "hire_date":  "2023-01-15"
}
```

### Módulo de Upload de PDFs (`/api/uploads`)

| Método   | Rota                        | Descrição                                        |
|----------|-----------------------------|--------------------------------------------------|
| `GET`    | `/api/uploads`              | Listar documentos prontos (paginado, filtros)    |
| `GET`    | `/api/uploads/tags`         | Listar todas as tags existentes                  |
| `GET`    | `/api/uploads/:id`          | Buscar documento por ID                          |
| `GET`    | `/api/uploads/:id/download` | Baixar o arquivo PDF com header `X-File-Hash`    |
| `GET`    | `/api/uploads/:id/verify`   | Verificar integridade (hash em disco vs. banco)  |
| `POST`   | `/api/uploads`              | Enviar PDF — executa pipeline completo           |
| `POST`   | `/api/uploads/search`       | Busca semântica dentro de um documento indexado  |
| `DELETE` | `/api/uploads/:id`          | Remover documento                                |

**Upload de PDF** — `multipart/form-data`:

| Campo         | Tipo    | Obrigatório | Descrição                                                           |
|---------------|---------|-------------|---------------------------------------------------------------------|
| `file`        | File    | Sim         | Arquivo PDF (máx. 10 MB)                                            |
| `employee_id` | integer | Não         | Vincular ao funcionário                                             |
| `description` | string  | Não         | Descrição do documento                                              |
| `tags`        | string  | Não         | Tags manuais separadas por vírgula — mescladas com as geradas pela LLM |

**Pipeline de upload (síncrono):**

```
POST /api/uploads
  1. Validação do arquivo (mimetype PDF, tamanho máximo)
  2. Cálculo do hash SHA-256 do arquivo (streaming, sem carregar na memória)
  3. Persistência inicial com sha256 + status='processing'
  4. Indexação RAG: extração de texto → chunks → embeddings (Ollama)
  5. Classificação automática: LLM gera tags + justificativa (Ollama)
  6. Persistência das tags e status='ready'
  7. Resposta 201 com documento + sha256 + tags geradas
```

> O documento **só aparece** em listagens e **só pode ser baixado** após a LLM definir as tags (status `ready`).
> Se o pipeline falhar, o registro é removido do banco e o arquivo é deletado do disco.
> O hash SHA-256 é calculado dos bytes brutos do arquivo e gravado no banco — qualquer alteração posterior é detectável via `GET /api/uploads/:id/verify`.

**Filtros disponíveis no `GET /api/uploads`:**

| Query Param   | Tipo    | Descrição                               |
|---------------|---------|-----------------------------------------|
| `page`        | integer | Página (padrão: 1)                      |
| `limit`       | integer | Itens por página (máx: 100)             |
| `employee_id` | integer | Filtrar por funcionário                 |
| `tags`        | string  | Tags separadas por vírgula (lógica AND) |

---

## Documentação da API (Swagger)

Com o servidor rodando, acesse:

```
http://localhost:3000/api-docs
```

O contrato OpenAPI 3.0 em JSON está disponível em:

```
http://localhost:3000/api-docs.json
```

---

## Banco de Dados

O banco de dados SQLite é criado automaticamente na primeira execução. As migrações são executadas via `src/config/database.js`.

### Tabelas

**`employees`**
| Coluna       | Tipo    | Restrições              |
|--------------|---------|-------------------------|
| id           | INTEGER | PK, autoincrement       |
| name         | TEXT    | NOT NULL                |
| email        | TEXT    | NOT NULL, UNIQUE        |
| cpf          | TEXT    | NOT NULL, UNIQUE        |
| department   | TEXT    | NOT NULL                |
| role         | TEXT    | NOT NULL                |
| salary       | REAL    | NOT NULL                |
| hire_date    | TEXT    | NOT NULL                |
| active       | INTEGER | DEFAULT 1               |
| created_at   | TEXT    | DEFAULT datetime('now') |
| updated_at   | TEXT    | DEFAULT datetime('now') |

**`pdf_documents`**
| Coluna        | Tipo    | Restrições                                   |
|---------------|---------|----------------------------------------------|
| id            | INTEGER | PK, autoincrement                            |
| employee_id   | INTEGER | FK → employees(id), nullable                 |
| filename      | TEXT    | NOT NULL                                     |
| original_name | TEXT    | NOT NULL                                     |
| mimetype      | TEXT    | NOT NULL                                     |
| size          | INTEGER | NOT NULL                                     |
| sha256        | TEXT    | Hash SHA-256 hex (64 chars) do arquivo       |
| description   | TEXT    | nullable                                     |
| status        | TEXT    | NOT NULL, DEFAULT `'ready'` (`processing` \| `ready`) |
| uploaded_at   | TEXT    | DEFAULT datetime('now')                      |

**`pdf_tags`**
| Coluna      | Tipo    | Restrições                                |
|-------------|---------|-------------------------------------------|
| id          | INTEGER | PK, autoincrement                         |
| document_id | INTEGER | FK → pdf_documents(id) ON DELETE CASCADE  |
| tag         | TEXT    | NOT NULL                                  |
|             |         | UNIQUE(document_id, tag)                  |

**`document_chunks`**
| Coluna      | Tipo    | Restrições                                |
|-------------|---------|-------------------------------------------|
| id          | INTEGER | PK, autoincrement                         |
| document_id | INTEGER | FK → pdf_documents(id) ON DELETE CASCADE  |
| chunk_index | INTEGER | NOT NULL                                  |
| content     | TEXT    | NOT NULL                                  |
| embedding   | TEXT    | NOT NULL (JSON de float[])                |

---

## Testes

```bash
# Todos os testes
npm test

# Apenas unitários
npm run test:unit

# Apenas integração
npm run test:integration

# Com cobertura
npm run test:coverage
```

### Cobertura esperada

| Módulo              | Cobertura  |
|---------------------|------------|
| employee.service    | > 95%      |
| upload.service      | > 90%      |
| employee.repository | integração |
| upload.repository   | integração |

### Estratégia de Testes

- **Unitários** (`tests/unit/`): testam os Services com repositórios e RagService mockados via Jest. Cobrem validações, regras de negócio, tratamento de erros e o pipeline completo de upload (incluindo cenários de falha do Ollama).
- **Integração** (`tests/integration/`): testam as rotas HTTP end-to-end usando Supertest + SQLite in-memory (banco isolado por suíte). Cobrem criação, leitura, atualização, deleção e casos de erro.

---

## Integração RAG (v2.0.0)

### Visão Geral

A versão 2.0 adiciona uma camada de **Geração Aumentada por Recuperação (RAG)** ao módulo de uploads, alimentada pelo **Ollama** — um runtime de LLM gratuito e local. Sem chaves de API, sem cobrança.

O diferencial desta versão é o **pipeline síncrono no upload**: o documento só fica disponível após a LLM analisar o conteúdo e gerar as tags. Isso garante que qualquer documento retornado pela API já venha classificado.

### Pré-requisitos

1. Instale o Ollama: https://ollama.com
2. Baixe os modelos necessários:

```bash
ollama pull nomic-embed-text   # ~270 MB — embeddings
ollama pull llama3.2           # ~2 GB   — classificação
```

3. Certifique-se de que o Ollama está em execução (`ollama serve`) antes de iniciar a API.

### Novas variáveis de ambiente

| Variável             | Padrão                   | Descrição                              |
|----------------------|--------------------------|----------------------------------------|
| `OLLAMA_URL`         | `http://localhost:11434` | URL do servidor Ollama                 |
| `OLLAMA_EMBED_MODEL` | `nomic-embed-text`       | Modelo para geração de embeddings      |
| `OLLAMA_LABEL_MODEL` | `llama3.2`               | Modelo para classificação de documentos|

### Nova dependência npm

```bash
npm install
# Adiciona: pdf-parse
```

### Nova tabela no banco

`document_chunks` — criada automaticamente pelo sistema de migrações.

`pdf_documents` ganha a coluna `status` (`processing` | `ready`).

### Endpoints de RAG

#### `POST /api/uploads` (atualizado)

O endpoint de upload agora executa o pipeline completo de forma síncrona e retorna o documento com as tags já definidas pela LLM.

```json
// Resposta 201
{
  "success": true,
  "message": "PDF enviado, analisado e classificado com sucesso",
  "data": {
    "id": 1,
    "original_name": "contrato_joao.pdf",
    "tags": ["contrato", "rh"],
    "status": "ready"
  }
}
```

> Retorna `422` se o pipeline falhar (Ollama indisponível, PDF sem texto, etc.).

#### `GET /api/uploads/:id/download` (atualizado)

O download agora inclui headers de integridade:

```
X-File-Hash:      sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
X-File-Hash-Algo: SHA-256
```

O cliente pode recomputar o SHA-256 do arquivo recebido e comparar com o header para garantir que o download não foi corrompido em trânsito.

#### `GET /api/uploads/:id/verify`

Verifica se o arquivo em disco ainda corresponde ao hash gravado no upload.

```json
// Resposta 200 — íntegro
{
  "success": true,
  "data": {
    "integrity": "ok",
    "stored_hash": "e3b0c44298fc1c149afb...",
    "actual_hash":  "e3b0c44298fc1c149afb...",
    "message": "Arquivo íntegro — hash confere com o registrado no upload"
  }
}

// Resposta 409 — corrompido ou alterado
{
  "success": false,
  "data": {
    "integrity": "mismatch",
    "stored_hash": "e3b0c44298fc1c149afb...",
    "actual_hash":  "aabbcc...",
    "message": "ATENÇÃO: hash não confere — o arquivo pode ter sido corrompido ou alterado"
  }
}
```

#### `POST /api/uploads/search`

Busca semântica dentro dos chunks de um documento indexado.

```json
// Corpo da requisição
{ "document_id": 1, "query": "data de rescisão contratual", "top_k": 3 }

// Resposta 200
{
  "success": true,
  "data": [
    { "chunk_index": 4, "content": "...", "score": 0.9142 },
    { "chunk_index": 5, "content": "...", "score": 0.8873 }
  ]
}
```

### Arquivos modificados / adicionados

| Arquivo                                         | Alteração                                                                          |
|-------------------------------------------------|------------------------------------------------------------------------------------|
| `src/modules/uploads/rag.service.js`            | Extração de texto, chunking, embeddings Ollama, busca cosseno, classificação LLM   |
| `src/modules/uploads/rag.repository.js`         | Leitura/escrita de `document_chunks` no SQLite                                     |
| `src/modules/uploads/upload.service.js`         | Pipeline síncrono: indexação → classificação → tags → status `ready`               |
| `src/modules/uploads/upload.repository.js`      | `findAll` filtra por `status='ready'`; novo método `updateTagsAndStatus()`         |
| `src/modules/uploads/upload.controller.js`      | Bloqueia download/listagem de documentos com `status != 'ready'`                   |
| `src/modules/uploads/upload.routes.js`          | Remove rota `/:id/analyze` (análise agora é parte do upload); Swagger atualizado   |
| `src/config/database.js`                        | Adiciona tabela `document_chunks` e coluna `status` em `pdf_documents`             |
| `package.json`                                  | Adiciona `pdf-parse`                                                               |
| `.env.example`                                  | Documenta variáveis de ambiente do Ollama                                          |

---

## Diagrama C4

Os diagramas C4 (Contexto, Container e Componente) estão disponíveis em `docs/c4/`:

- `c4-nivel1-contexto.md` — Visão geral do sistema, atores externos e integração com Ollama
- `c4-nivel2-container.md` — Containers: API, banco de dados, armazenamento de arquivos e Ollama; fluxo de upload
- `c4-nivel3-componente.md` — Componentes internos da API (módulos, camadas, pipeline detalhado)

---

## Health Check

```
GET /health
```

```json
{ "status": "ok", "timestamp": "2025-01-01T12:00:00.000Z" }
```
