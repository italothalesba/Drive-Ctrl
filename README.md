# Drive Ctrl - Guia de Instalação Local

Este guia explica como rodar o **Drive Ctrl** no seu próprio computador ou servidor local.

## 1. Pré-requisitos

*   **Node.js:** Versão 18 ou superior. [Baixe aqui](https://nodejs.org/).
*   **Editor de Código:** Recomendamos o [VS Code](https://code.visualstudio.com/).

## 2. Preparação do Projeto

1.  **Baixe os arquivos:** Copie todos os arquivos do projeto para uma pasta no seu computador.
2.  **Abra o terminal:** Navegue até a pasta do projeto.
3.  **Instale as dependências:**
    ```bash
    npm install
    ```

## 3. Configuração do Ambiente (.env)

Crie um arquivo chamado `.env` na raiz do projeto (mesmo local do `package.json`) e cole o seguinte conteúdo:

```env
# Configurações de Segurança
JWT_SECRET="crie_uma_frase_longa_e_aleatoria_aqui"

# Credenciais do Administrador
ADMIN_USERNAME="admin"
ADMIN_PASSWORD="sua_senha_segura_aqui"

# Local onde os arquivos serão salvos (Ex: ./data ou C:/MeuDrive)
STORAGE_ROOT="./data"

# Porta do Servidor
PORT=3000
```

## 4. Executando em Modo de Desenvolvimento

Para rodar o sistema com recarregamento automático enquanto você faz alterações:

```bash
npm run dev
```

O sistema estará disponível em: `http://localhost:3000`

## 5. Rodando em Modo de Produção (Para Uso Real)

Se você for deixar o sistema rodando permanentemente no hospital:

1.  **Gere a build do frontend:**
    ```bash
    npm run build
    ```
2.  **Inicie o servidor final:**
    ```bash
    npm start
    ```

## 6. Acesso Externo (Opcional)

Se você quiser acessar o drive de fora do hospital (pela internet), você tem duas opções principais:

*   **IP Fixo + Redirecionamento de Porta:** Configurar o roteador do hospital para apontar a porta 3000 para o IP do computador servidor.
*   **Cloudflare Tunnel (Recomendado):** Uma forma segura de expor o servidor local sem abrir portas no roteador.

---

### Dicas de Segurança Local
*   **Backup:** Lembre-se de fazer backup periódico da pasta definida em `STORAGE_ROOT`.
*   **Permissões:** Garanta que o usuário que rodar o Node.js tenha permissão de escrita na pasta de arquivos.
*   **Antivírus:** Algumas soluções de antivírus podem bloquear o servidor Node.js; se o upload falhar, verifique o firewall.

---
**Drive Ctrl - Suporte Técnico**
*WhatsApp: (88) 9 8842-5694*
