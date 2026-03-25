# Workflow Cursos

## Publicacao

Para publicar no seu proprio servidor, gere o build padrao:

```bash
npm run build
```

Os arquivos finais ficam em `dist/`. Publique o conteudo dessa pasta no diretorio servido pelo seu servidor web.

O projeto usa `hash` no roteamento, entao nao precisa de regra especial de rewrite para as rotas da aplicacao.

Se algum dia precisar voltar ao GitHub Pages, use:

```bash
npm run build:gh-pages
```

## Deploy com GitHub Actions

O workflow [deploy.yml](D:\projects\angular\asam\workflow-cursos\.github\workflows\deploy.yml) publica automaticamente por SFTP para `/public_html` quando houver push na branch `main` ou quando voce executar manualmente em `Actions`.

Cadastre estes secrets no repositorio do GitHub:

- `SFTP_HOST`
- `SFTP_PORT`
- `SFTP_USERNAME`
- `SFTP_PASSWORD`

Valores para o seu servidor:

- `SFTP_HOST`: `212.85.7.185`
- `SFTP_PORT`: `65002`
- `SFTP_USERNAME`: `u384672866_nDkhILDZZ`
- `SFTP_PASSWORD`: sua senha do SFTP
