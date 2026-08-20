# Pecuária Smart — Módulo de Análise e Classificação de Rebanho

Sistema de identificação e monitoramento de bovinos confinados com suporte a câmera (OCR), balança USB/Serial e integração com banco de dados SQLite.

## Requisitos

- **Node.js**: ≥ 18.0.0 (usa `node:sqlite` nativo)
- **npm**: ≥ 9.0.0
- **SQLite**: incluído no Node.js 22+

## Instalação

### 1. Clonar repositório

```bash
git clone https://github.com/juliodefreitas/Livestock-project.git
cd Livestock-project
```

### 2. Instalar dependências

```bash
npm ci
```

### 3. Configurar variáveis de ambiente (opcional)

Copie `.env.example` para `.env` e ajuste conforme necessário:

```bash
cp .env.example .env
```

Variáveis disponíveis:
- `PORT`: porta do servidor (padrão: 3000)
- `NODE_ENV`: ambiente de execução (development/production)
- `DB_PATH`: caminho do banco SQLite (padrão: data/pecuaria.db)
- `CORS_ORIGIN`: origem permitida para CORS
- `CAMERA_DEVICE_ID`: ID da câmera USB (padrão: 0)
- `SCALE_PORT`: porta serial da balança (padrão: COM3/Linux: /dev/ttyUSB0)
- `SCALE_BAUD_RATE`: velocidade serial (padrão: 9600)

### 4. Executar migrações do banco

```bash
npm run migrate
```

### 5. Semear dados de exemplo (opcional)

```bash
npm run seed
```

## Executar a aplicação

### Modo desenvolvimento (com auto-reload)

```bash
npm run dev
```

### Modo produção

```bash
npm start
```

O servidor estará disponível em `http://localhost:3000` (ou na `PORT` configurada).

## Testar

Executar testes unitários:

```bash
npm test
```

Validar dependências:

```bash
npm run audit
```

## Arquitetura

### Backend (Express + SQLite)

- **Routes**: `/api/animais`, `/api/lotes`, `/api/rebanho`, `/api/pesagens`, `/api/camera`, `/api/cotacao`
- **Services**: cálculos, classificação, integrações de hardware, preços
- **Database**: SQLite com migrações automáticas

### Frontend (HTML + Chart.js)

- Dashboard de lote com filtros por sexo
- Gráficos de peso e ganho médio diário (GMD)
- Listagem de animais com ficha individual

## Endpoints principais

### Saúde

- `GET /api/health` → Status do servidor

### Lotes

- `GET /api/lotes` → Listar lotes
- `POST /api/lotes` → Criar lote
- `GET /api/lotes/:id` → Detalhes do lote

### Animais

- `GET /api/animais` → Listar animais (filtro: `?lote_id=`, `?sexo=`)
- `POST /api/animais` → Registrar animal
- `GET /api/animais/:id` → Detalhes do animal
- `PATCH /api/animais/:id` → Atualizar animal

### Rebanho (agregados)

- `GET /api/rebanho` → Rebanho com métricas por lote
- `GET /api/rebanho/:id` → Ficha individual com histórico

### Pesagens

- `POST /api/pesagens` → Registrar pesagem manual
- `GET /api/pesagens/animal/:animalId` → Histórico de animal
- `GET /api/pesagens/lote/:loteId` → Histórico de lote
- `POST /api/pesagens/camera` → Pesagem integrada com câmera + OCR + balança

### Câmera / OCR

- `POST /api/camera/initialize` → Inicializar câmera e OCR
- `POST /api/camera/capture` → Capturar imagem
- `POST /api/camera/identify-brinco` → Identificar brinco via OCR
- `POST /api/camera/identify-and-validate` → Fluxo completo: captura → OCR → busca no BD

### Cotação de Arroba

- `GET /api/cotacao/arroba` → Preço atual da arroba
- `POST /api/cotacao/arroba` → Inserir cotação manual

## Modelo de dados

### Tabelas

- **lote**: identifica lotes de animais
- **animal**: dados do animal (brinco, raça, sexo, data de nascimento, idade estimada, condição reprodutiva, lote)
- **pesagem**: peso e data de pesagem por animal (origem: manual, balanca, camera)
- **cotacao_arroba**: preço da arroba com fonte e data de referência

### Validações

- `id_brinco`: único por animal
- `sexo`: deve ser 'macho' ou 'femea'
- `condicao_reprodutiva`: null, 'inteiro', 'castrado', 'vazia', 'prenha', 'com_cria_ao_pe'
- `peso_kg`: entre 50 e 2000 kg
- `data_pesagem`: não pode ser no futuro
- `data_entrada`: não pode ser no futuro
- `origem`: 'manual', 'balanca' ou 'camera'

## Serviços principais

### Calculation Service

- `calcularIdadeMeses(dataUltimaQueda, estimativaIdade)`: calcula idade a partir de data de nascimento ou estimativa
- `kgParaArrobas(kg)`: converte kg para arrobas (15 kg = 1 @ )
- `calcularGMD(pesagens)`: ganho médio diário (GMD) entre pesagens ordenadas

### Classification Service

- Regras configuráveis em `backend/config/classification_rules.json`
- Primeira regra compatível define a categoria
- Parâmetros: sexo, idade, condição reprodutiva, peso em arrobas

### Camera Service (Opcional)

- Captura de imagens via câmera USB
- Armazena imagens em `data/camera_images/`
- Funções de burst (múltiplas capturas)

### OCR Service (Opcional)

- Identifica número do brinco via OCR (Tesseract.js)
- Valida brinco no banco de dados
- Retorna confiança da leitura

### Scale Service (Opcional)

- Conexão via USB/Serial com balança
- Parsing de dados de peso
- Histórico de últimas pesagens

## Integração física no notebook

### Equipamentos necessários

- Notebook Windows com Node.js 18 ou superior e uma porta USB livre.
- Arduino Uno, Nano ou Mega com cabo USB de dados.
- Módulo amplificador HX711, um para cada conjunto de células configurado.
- Quatro células de carga compatíveis com a capacidade da plataforma, normalmente 50 kg, 100 kg ou 500 kg cada.
- Plataforma metálica ou balança de contenção dimensionada para o peso do animal.
- Caixa de proteção, bornes, fios, conectores e fonte USB estável para o Arduino.
- Webcam USB com foco adequado para enquadrar o número do brinco e iluminação difusa.
- Cabo USB adicional para a webcam, se necessário.

### Montagem e software

1. Ligue as células de carga ao HX711 conforme o diagrama do fabricante. Em uma plataforma de quatro células, use uma caixa de junção para formar a ponte antes do HX711.
2. Ligue `VCC`, `GND`, `DT` e `SCK` do HX711 ao Arduino. O firmware deve fazer tara, calibração e enviar uma leitura por linha, por exemplo `432.50 kg`.
3. Conecte o Arduino e a webcam ao notebook. No Windows, descubra a porta em **Gerenciador de Dispositivos > Portas (COM e LPT)**.
4. Copie `.env.example` para `.env` e ajuste `SCALE_PORT`, `SCALE_BAUD_RATE` e `CAMERA_DEVICE_ID`.
5. Instale as dependências e permita os scripts nativos quando solicitado:

```powershell
npm install
npm approve-scripts
npm run migrate
npm start
```

6. Abra `http://localhost:3000`, use **Configurar hardware** e depois **Iniciar pesagem**.

O servidor não grava o peso imediatamente: aguarda amostras consecutivas dentro da tolerância definida por `SCALE_STABLE_SAMPLES` e `SCALE_STABLE_TOLERANCE_KG`. O OCR exige que o texto do brinco esteja visível e com contraste suficiente; a leitura precisa corresponder a um `id_brinco` já cadastrado no banco.

### Firmware do Arduino

O projeto Node.js recebe o peso, mas não grava firmware no Arduino. O Arduino precisa ser programado separadamente para ler o HX711 e transmitir linhas como:

```text
432.50 kg
```

Também são necessários tara e calibração usando um peso conhecido. Sem esse firmware e sem a calibração mecânica, a porta COM pode estar conectada, mas o peso registrado não será confiável.

O firmware de referência está em `arduino/hx711_scale/hx711_scale.ino`. Na Arduino IDE, instale a biblioteca **HX711** pelo gerenciador de bibliotecas, selecione a placa e a porta corretas, ajuste `calibrationFactor`, grave o sketch e confirme no Monitor Serial em 9600 baud que aparecem linhas no formato `432.50 kg`.

## Segurança

- **CORS**: restringido por `CORS_ORIGIN` (padrão: http://localhost:3000)
- **Limite JSON**: 10MB
- **Validações**: todas as entradas são validadas antes de uso
- **Erros**: em produção, não expõem stack trace ou SQL
- **Logs**: ações críticas (pesagem, cotação, hardware) são registradas

### Limitações conhecidas

- **Sem autenticação**: recomenda-se implementar em ambiente de produção
- **Sem rate limiting**: camada preparada para implementação futura
- **Hardware opcional**: endpoints retornam 503 se dispositivo não estiver disponível

## Desenvolvimento

### Estrutura de pastas

```
.
├── backend/
│   ├── db/
│   │   ├── database.js        # Conexão SQLite
│   │   ├── migrate.js         # Migrações
│   │   └── seed.js            # Dados iniciais
│   ├── routes/
│   │   ├── animais.js
│   │   ├── lotes.js
│   │   ├── rebanho.js
│   │   ├── pesagens.js
│   │   ├── pesagensCamera.js  # Integração câmera
│   │   ├── camera.js          # Endpoints de câmera
│   │   └── cotacao.js
│   ├── services/
│   │   ├── calculationService.js
│   │   ├── classificationService.js
│   │   ├── priceService.js
│   │   ├── cameraService.js
│   │   ├── brincoOCRService.js
│   │   ├── scaleService.js
│   │   └── __tests__/         # Testes unitários
│   ├── utils/
│   │   └── validation.js      # Validadores
│   ├── config/
│   │   └── classification_rules.json
│   └── server.js              # Servidor principal
├── frontend/
│   └── index.html
├── data/
│   └── camera_images/         # Imagens capturadas
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

### Testes

Usar `node --test` (nativo do Node.js):

```bash
npm test
```

Testes incluem:
- Validação de domínio (idade, peso, datas)
- Cálculos (arrobas, GMD, valor estimado)
- Classificação de categoria
- Normalização de payload de pesagem

### Adicionar novo teste

Criar arquivo em `backend/services/__tests__/seu-teste.test.js`:

```javascript
const test = require('node:test');
const assert = require('node:assert/strict');

test('descrição do teste', () => {
  assert.equal(resultado, esperado);
});
```

## Integração de hardware

### Câmera

Endpoints preparados em `/api/camera/*`. Hardware opcional — sem câmera, endpoint retorna erro 503.

A implementação real de captura de imagem está preparada como extensão futura (o serviço atual gera imagens dummy para testes).

### OCR (Tesseract)

Identifica número do brinco em imagens. Requer `tesseract.js` (dependência opcional).

### Balança (Serial/USB)

Conexão via `serialport` (dependência opcional). Configurável via `.env` com porta e baud rate.

## Troubleshooting

### Erro: "Câmera não inicializada"

Certifique-se de que:
1. A câmera está conectada ao USB
2. Chamou `POST /api/camera/initialize` antes
3. Em Linux/Mac, verifique permissões: `sudo usermod -a -G dialout $USER`

### Erro: "Balança não conectada"

1. Verifique a porta serial: `npm ls serialport`
2. Configure `SCALE_PORT` corretamente (COM3 no Windows, /dev/ttyUSB0 no Linux)
3. Valide baud rate (padrão: 9600)

### Erro: "Banco bloqueado"

SQLite em WAL mode. Se persistir:
```bash
rm data/pecuaria.db-wal data/pecuaria.db-shm
npm run migrate
```

## Roadmap

- [ ] Autenticação e permissões (JWT)
- [ ] Rate limiting por endpoint
- [ ] Exportação de relatórios (PDF/CSV)
- [ ] Integração com API de cotação de mercado
- [ ] Dashboard em React/Vue
- [ ] Suporte a múltiplas câmeras
- [ ] Sincronização em nuvem

## Licença

MIT

## Suporte

Consulte [Issues](https://github.com/juliodefreitas/Livestock-project/issues) no repositório.
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
