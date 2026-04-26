# C4 — Nível 1: Diagrama de Contexto

```
╔══════════════════════════════════════════════════════════════════════════════╗
║                        DIAGRAMA DE CONTEXTO (C4 — Nível 1)                 ║
╚══════════════════════════════════════════════════════════════════════════════╝

  ┌─────────────────┐          ┌─────────────────┐
  │   👤 Usuário    │          │ 👤 Admin de RH  │
  │   da API /      │          │                 │
  │  Desenvolvedor  │          │  Gerencia       │
  └────────┬────────┘          └────────┬────────┘
           │ Faz requisições            │ Cadastra funcionários
           │ HTTP (REST)                │ e faz upload de PDFs
           │                            │
           ▼                            ▼
  ╔══════════════════════════════════════════════════╗
  ║                                                  ║
  ║          Employee Management System              ║
  ║                                                  ║
  ║  Sistema RESTful para cadastro de funcionários   ║
  ║  e gerenciamento de documentos PDF.              ║
  ║  PDFs enviados são automaticamente indexados     ║
  ║  via RAG e classificados por uma LLM local       ║
  ║  (Ollama) antes de ficarem disponíveis.          ║
  ║                                                  ║
  ╚══════════════════════════════════════════════════╝
           │                 │                  │
           ▼                 ▼                  ▼
  ┌──────────────┐  ┌──────────────────┐  ┌──────────────────┐
  │ 📂 Sistema   │  │ 🤖 Ollama (LLM)  │  │ 📊 Ferramentas   │
  │ de Arquivos  │  │ Servidor local   │  │ de Relatório /   │
  │              │  │                  │  │ BI Externo       │
  │ Armazena os  │  │ Gera embeddings  │  │ (opcional)       │
  │ arquivos PDF │  │ e classifica     │  │                  │
  │ enviados     │  │ documentos       │  │ Consome a API    │
  └──────────────┘  └──────────────────┘  └──────────────────┘
```

## Atores e Sistemas Externos

| Ator / Sistema          | Tipo     | Descrição                                                                          |
|-------------------------|----------|------------------------------------------------------------------------------------|
| **Usuário da API**      | Pessoa   | Desenvolvedor ou sistema externo que consome os endpoints REST                     |
| **Admin de RH**         | Pessoa   | Usuário interno que cadastra funcionários e envia documentos via API               |
| **Sistema de Arquivos** | Externo  | Diretório local (ou futuro storage em nuvem) para persistência dos PDFs            |
| **Ollama**              | Externo  | Servidor LLM local. Fornece embeddings (`nomic-embed-text`) e geração de texto (`llama3.2`) para indexação RAG e classificação automática de documentos |
| **Ferramentas de BI**   | Externo  | Sistemas externos que consomem a API para relatórios e dashboards                  |

## Descrição

O **Employee Management System** é o sistema central. Ele:

- Recebe requisições HTTP REST de usuários e sistemas externos
- Persiste dados de funcionários em banco de dados relacional (SQLite)
- Ao receber um PDF, executa um pipeline síncrono: indexação RAG → classificação LLM → disponibilização do documento
- Documentos só ficam visíveis e disponíveis para download **após** a LLM definir as tags automaticamente
- Expõe documentação interativa via Swagger UI
