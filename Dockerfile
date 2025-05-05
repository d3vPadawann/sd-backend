FROM node:20-alpine AS builder

# Criar diretório de trabalho
WORKDIR /app

# Copiar arquivos de configuração primeiro para melhor aproveitamento de cache
COPY package*.json ./
COPY tsconfig*.json ./
# Não copie o arquivo resolve-tsconfig.js pois ele não existe
COPY .env* ./ 2>/dev/null || true

# Instalar dependências
RUN npm ci

# Copiar código fonte
COPY ./src ./src

# Executar o build
RUN npm run build || mkdir -p dist

# Segunda etapa: imagem de produção
FROM node:20-alpine

WORKDIR /app

# Copiar package.json e lockfile
COPY package*.json ./
COPY .env* ./ 2>/dev/null || true

# Instalar apenas dependências de produção
RUN npm ci --omit=dev

# Copiar código compilado
COPY --from=builder /app/dist ./dist

# Expor porta
EXPOSE 3000

# Definir variáveis de ambiente
ENV NODE_ENV=production

# Iniciar aplicação
CMD ["node", "dist/server.js"]