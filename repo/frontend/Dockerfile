FROM node:22-alpine
WORKDIR /app
RUN apk add --no-cache chromium
COPY package*.json ./
RUN npm install
COPY . .
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
EXPOSE 4200
CMD ["npm","run","start","--","--host","0.0.0.0","--port","4200"]
