# Materiais para integração da pesagem automática

Este documento lista os materiais necessários para integrar câmera, Arduino, células de carga, HX711 e o servidor local do sistema Pecuária Smart.

## Situação informada do projeto

- **Câmera:** será uma webcam USB, portanto não é necessário adquirir uma câmera industrial neste momento.
- **Arduino:** será cedido pela faculdade. Antes da montagem, confirme o modelo da placa, o cabo USB e a porta COM utilizada.
- **Itens que ainda precisam ser confirmados ou adquiridos:** células de carga, HX711, plataforma/brete, cabos, conectores, proteção elétrica e iluminação.

## 1. Computador e comunicação

| Quantidade | Material | Especificação/função |
|---:|---|---|
| 1 | Notebook | Windows, Node.js 18 ou superior, navegador atualizado e pelo menos duas portas USB disponíveis, ou um hub alimentado. |
| 1 | Cabo USB de dados | Compatível com o Arduino cedido pela faculdade. Deve permitir transmissão de dados, não somente carregamento. |
| 1 | Cabo USB adicional | Para a webcam USB, caso ela não tenha cabo integrado. |
| 1 | Hub USB alimentado | Opcional. Recomendado se o notebook não tiver portas USB suficientes ou se a câmera consumir muita energia. |

## 2. Identificação por câmera

| Quantidade | Material | Especificação/função |
|---:|---|---|
| 1 | Webcam USB | Será providenciada. Preferencialmente 720p ou superior, com foco adequado para o número do brinco. |
| 1 | Suporte para webcam | Mantém a câmera fixa e direcionada para o brinco. |
| 1 | Iluminação LED | Luz difusa para evitar sombras e reflexos no brinco. |
| 1 | Proteção para câmera | Opcional. Protege a webcam contra poeira, umidade e impactos no ambiente rural. |

### Recomendações para a câmera

- Instalar a câmera em posição fixa.
- Manter o brinco dentro do enquadramento durante a captura.
- Evitar luz direta refletindo no brinco.
- Usar fundo com contraste suficiente.
- Cadastrar previamente no banco o mesmo identificador que será impresso no brinco.

## 3. Plataforma de pesagem

| Quantidade | Material | Especificação/função |
|---:|---|---|
| 1 | Plataforma ou brete de pesagem | Estrutura metálica capaz de suportar o peso máximo do animal. |
| 4 | Células de carga | Mesmo modelo e mesma capacidade nominal. A capacidade deve ser compatível com a plataforma e o animal. |
| 1 | Caixa de junção | Combina os sinais das quatro células em uma ponte de pesagem. |
| 1 | Módulo HX711 | Amplificador e conversor analógico-digital para as células de carga. |
| 1 | Kit de fixação | Parafusos, porcas, arruelas e suportes para fixar as células à estrutura. |
| 1 | Caixa de proteção elétrica | Protege o HX711, bornes e conexões contra água, poeira e impacto. |
| 1 | Piso antiderrapante | Reduz o risco de o animal escorregar durante a pesagem. |

### Recomendações para as células de carga

- As quatro células devem ter a mesma capacidade e características elétricas.
- A estrutura precisa distribuir o peso de maneira uniforme.
- As células não devem encostar diretamente em partes móveis ou inclinadas da estrutura.
- A plataforma deve ser nivelada antes da calibração.
- A capacidade total do conjunto deve considerar o peso máximo do animal com margem de segurança.

## 4. Arduino e ligações elétricas

| Quantidade | Material | Especificação/função |
|---:|---|---|
| 1 | Arduino Uno, Nano ou Mega | Será cedido pela faculdade. Controlador responsável por ler o HX711 e enviar o peso ao notebook. |
| 1 | Cabo USB de dados | Comunicação entre o Arduino cedido e o notebook. |
| 1 | Protoboard ou placa de terminais | Opcional. Facilita testes e organização das ligações. |
| 1 | Conjunto de fios | Fios para alimentação, sinais e conexão entre HX711 e Arduino. |
| 1 | Bornes e conectores | Recomendados para conexões firmes e manutenção. |
| 1 | Fonte USB estável | Pode ser a alimentação USB do notebook, desde que suficiente para o Arduino e o HX711. |
| 1 | Fusível ou proteção elétrica | Recomendado para proteger a alimentação em instalações permanentes. |

### Ligação do HX711 ao Arduino

O firmware de referência utiliza os seguintes pinos:

| HX711 | Arduino |
|---|---|
| VCC | 5V |
| GND | GND |
| DT/DOUT | D3 |
| SCK/CLK | D2 |

As células de carga devem ser ligadas ao HX711 conforme o esquema do fabricante. Em uma plataforma com quatro células, normalmente a conexão passa primeiro pela caixa de junção.

O firmware de referência está em [arduino/hx711_scale/hx711_scale.ino](arduino/hx711_scale/hx711_scale.ino).

## 5. Materiais de instalação e proteção

| Quantidade | Material | Especificação/função |
|---:|---|---|
| 1 | Eletroduto ou canaleta | Protege os cabos entre a plataforma, o Arduino e o notebook. |
| 1 | Caixa organizadora | Mantém Arduino e HX711 protegidos e identificados. |
| 1 | Kit de abraçadeiras | Organização dos cabos. |
| 1 | Fita isolante e termo-retrátil | Isolamento e proteção das emendas. |
| 1 | Etiquetas de identificação | Identificação de cabos, células e conectores. |
| 1 | Multímetro | Verificação de continuidade, tensão e possíveis curtos. |
| 1 | Régua de nível | Nivelamento da plataforma. |
| 1 | Peso padrão conhecido | Calibração da balança. Recomenda-se utilizar um peso aferido. |

## 6. Software necessário

### No notebook

- Node.js 18 ou superior.
- npm.
- Arduino IDE.
- Driver USB do Arduino, quando necessário.
- Biblioteca Arduino **HX711**.
- Dependências Node.js do projeto:
  - `serialport`;
  - `@serialport/parser-readline`;
  - `node-webcam`;
  - `tesseract.js`.

### Instalação do projeto

```powershell
npm install
npm approve-scripts
npm run migrate
npm start
```

Depois, acessar:

```text
http://localhost:3000
```

## 7. Configuração do servidor

Copie `.env.example` para `.env` e ajuste os valores:

```env
PORT=3000
DB_PATH=data/pecuaria.db
CAMERA_DEVICE_ID=0
CAMERA_WIDTH=1280
CAMERA_HEIGHT=720
CAMERA_QUALITY=85
SCALE_PORT=COM3
SCALE_BAUD_RATE=9600
SCALE_SERIAL_ENABLED=true
SCALE_STABLE_SAMPLES=3
SCALE_STABLE_TOLERANCE_KG=1
```

A porta `COM3` é apenas um exemplo. Use a porta exibida no **Gerenciador de Dispositivos do Windows**.

## 8. Firmware do Arduino

O Arduino precisa:

1. Ler as células por meio do HX711.
2. Executar a tara inicial.
3. Usar um fator de calibração ajustado com peso conhecido.
4. Enviar pela serial em 9600 baud uma linha de cada vez, por exemplo:

```text
432.50 kg
```

O servidor considera o peso válido somente entre 50 e 2000 kg e aguarda amostras estáveis antes de registrar a pesagem.

## 9. Checklist de montagem

- [ ] Células de carga instaladas na posição correta.
- [ ] Plataforma nivelada e firme.
- [ ] HX711 protegido em caixa elétrica.
- [ ] Arduino conectado ao HX711.
- [ ] Câmera fixada e enquadrada.
- [ ] Cabos protegidos contra pisoteio e umidade.
- [ ] Porta COM identificada no Windows.
- [ ] Biblioteca HX711 instalada na Arduino IDE.
- [ ] Firmware gravado no Arduino.
- [ ] Fator de calibração ajustado.
- [ ] Arduino transmitindo linhas no formato `peso kg`.
- [ ] Banco migrado.
- [ ] Servidor local iniciado.
- [ ] Animal e identificador do brinco cadastrados.
- [ ] Hardware configurado na interface.
- [ ] Pesagem testada com um peso conhecido antes de usar com animais.

## 10. Observações de segurança

- Teste toda a instalação sem animal antes da operação.
- Não deixe fios expostos na área de circulação dos animais.
- Use proteção contra água e limpeza com jato.
- Não faça conexões elétricas com o Arduino energizado.
- A plataforma deve suportar o peso máximo previsto com margem de segurança.
- A calibração deve ser refeita quando a plataforma for desmontada, deslocada ou sofrer alteração estrutural.
