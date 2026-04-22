# Deploy

## GitHub Actions + SFTP

O workflow em `.github/workflows/deploy.yml` faz o build da aplicacao e envia o conteudo de `dist/` por SFTP para `public_html`.

### Secrets necessarios

- `SFTP_HOST`
- `SFTP_PORT`
- `SFTP_USERNAME`
- `SFTP_PASSWORD`

### Como executar

- push na branch `main`
- ou execucao manual em `Actions > Deploy to Server`
