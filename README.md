# Pecuária Smart — Módulo de Análise e Classificação de Rebanho

Este repositório contém a API e o painel de visualização para o módulo de análise de rebanho do sistema Pecuária Smart.

## O que foi implementado

- Atualização da entidade `Animal` com campos de `sexo`, `data_nascimento`, `idade_estimada_meses`, `condicao_reprodutiva`, `data_entrada` e `lote_id`.
- Cálculo automático de idade em meses a partir de `data_nascimento` ou `idade_estimada_meses`.
- Cálculo de peso em arrobas (`peso_arrobas = peso_kg / 15`) e exibição junto ao peso em kg.
- Serviço de cotação de arroba (`priceService`) com cache diário e fallback para cotação manual salva no banco.
- Classificação automática de categoria comercial/zootécnica baseada em regras configuráveis em `backend/config/classification_rules.json`.
- Endpoints de API para listagem de rebanho, ficha individual de animal e agregados por lote.
- Interface front-end PWA simples em `frontend/index.html` com dashboard de lote e gráficos usando Chart.js.

## Modelo de dados

As tabelas principais são:

- `lote`: identifica lotes de animais.
- `animal`: identifica o animal e guarda `id_brinco`, `raca`, `sexo`, `data_nascimento`, `idade_estimada_meses`, `condicao_reprodutiva`, `data_entrada` e `lote_id`.
- `pesagem`: armazena `peso_kg` e `data_pesagem` por animal.
- `cotacao_arroba`: guarda preços manuais de arroba, com `fonte` e `data_referencia`.

## Serviço de cotação da arroba

O backend implementa `backend/services/priceService.js` com as seguintes regras:

- Busca primeiro uma fonte externa (função `fetchFromExternalSource()` preparada para extensão).
- Se a fonte externa não estiver disponível, usa a última cotação manual salva em `cotacao_arroba`.
- Cacheia o valor por 24h para reduzir chamadas e refletir a atualização diária.
- Endpoint para consulta: `GET /api/cotacao/arroba`
- Endpoint para inserção manual: `POST /api/cotacao/arroba`

### Nota técnica

A cotação é considerada a arroba de peso vivo: `1 @ = 15 kg de peso vivo`. Esta distinção é ressaltada na interface.

## Classificação de categoria

As regras de classificação estão em `backend/config/classification_rules.json`.

- A ordem das regras importa: a primeira regra que casar define a categoria.
- A classificação usa `sexo`, `idadeMeses`, `condicao_reprodutiva` e `peso_arrobas`.
- O resultado inclui um aviso explicando que se trata de estimativa automática.

## Endpoints principais

- `GET /api/rebanho`: lista o rebanho completo, com filtro opcional `?lote_id=` e `?sexo=`.
- `GET /api/rebanho/:id`: ficha individual de animal com histórico de peso e cálculo de valor estimado.
- `GET /api/lotes`: lista lotes.
- `GET /api/lotes/:id`: agregados por lote com distribuição, média de peso e valor estimado total.
- `POST /api/animais`: cadastro de animal.
- `PUT /api/animais/:id`: atualização de animal.
- `POST /api/pesagens`: registro de pesagem.
- `GET /api/cotacao/arroba`: cotação atual de arroba.
- `POST /api/cotacao/arroba`: salva cotação manual.
- `GET /api/cotacao/classificacao`: metadados das regras de classificação.

## Como rodar

Instale as dependências e execute o servidor:

```bash
npm install
npm run start
```

Na primeira execução, popu o banco com dados de exemplo:

```bash
npm run seed
```

Ou use a flag `--seed` diretamente:

```bash
node backend/server.js --seed
```

O frontend está em `frontend/index.html` e é servido diretamente pelo servidor Express.

## Observações

- A lógica de classificação é configurável e deve ser validada com literatura zootécnica ou orientação acadêmica.
- O sistema suporta múltiplas raças e mestiços via campo `raca` livre.
- A integração automática de cotação está preparada como extensão futura.
