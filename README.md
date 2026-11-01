# myten-practice-test-generator

Myten is a lightweight practice test generator that builds customizable quizzes
from JSON question banks.

## Formato do banco de questões

Os arquivos JSON devem ficar no diretório `Base/`. O formato recomendado é um
objeto com a propriedade `questions`, contendo uma lista de questões:

```json
{
  "questions": [
    {
      "statement": "Which tissue is primarily responsible for voluntary movement?",
      "alternatives": [
        "Skeletal muscle",
        "Smooth muscle",
        "Cardiac muscle",
        "Connective tissue"
      ],
      "correctAnswer": "Skeletal muscle"
    }
  ]
}
```

### Campos obrigatórios

| Campo | Tipo | Descrição |
| --- | --- | --- |
| `statement` | `string` | Enunciado da questão. |
| `alternatives` | `string[]` | Lista de alternativas exibidas. |
| `correctAnswer` | `string` | Texto exato da alternativa correta. |

O valor de `correctAnswer` deve ser igual, caractere por caractere, a uma das
strings de `alternatives`.

## Formatos também aceitos

O carregador também aceita um array diretamente:

```json
[
  {
    "statement": "The deltoid muscle is located in the shoulder.",
    "alternatives": ["Right", "Wrong"],
    "correctAnswer": "Right"
  }
]
```

E aceita uma única questão diretamente:

```json
{
  "statement": "Is this a sample question?",
  "alternatives": ["Right", "Wrong"],
  "correctAnswer": "Right"
}
```

Questões inválidas são ignoradas durante o carregamento. Para garantir que uma
questão seja carregada, `statement` e `correctAnswer` devem ser strings, e
`alternatives` deve ser um array formado apenas por strings.
