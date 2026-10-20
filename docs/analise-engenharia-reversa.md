# Análise do app original com o REA

Este documento registra como o app de referência foi estudado e como cada parte dele virou (ou não) uma funcionalidade do **Cofrinho**. O código do Cofrinho foi escrito do zero: nada de código decompilado, imagens, sons ou textos do original foi copiado.

## 1. Artefato analisado

| Item | Valor |
|---|---|
| Arquivo | `Money-Tracker-Expense-Budget_1.1.147_apkcube.apks` (bundle de APKs divididos) |
| Pacote | `com.freeman.moneymanager` · versionCode 357 · versão 1.1.147 |
| Conteúdo | `base.apk` + 30 splits (`arm64_v8a`, densidades de tela e 22 idiomas) |
| Tecnologia | Flutter (Dart AOT em `lib/arm64-v8a/libapp.so`, engine em `libflutter.so`) |
| Hash do snapshot Dart | `78da37fed6bf1489361a312568249f3f` |
| Build ID da engine | `0d216f3f630e1105257f8a3f74e22c9b43c22a51` |
| SHA-256 do split arm64 | `229802817ef419182e545dab374e3d68893de8bca0d9fd917f218590f04d8820` |

## 2. Método e ferramentas

Ferramenta principal: **REA — Reverse Engineer Anything** (`D:\Projects\Software Terceiros\rea`, v6.7.0), usada pela CLI.

| Passo | Comando / técnica | O que revelou |
|---|---|---|
| Identificar o tipo de app | `rea identify-flutter-build split_config.arm64_v8a.apk` | Flutter confirmado, hash do snapshot, build da engine, toolchain clang 19 |
| Ler o snapshot Dart | `rea inspect-dart-aot split_config.arm64_v8a.apk` | URIs de pacotes (`package:moneymanager/...`), ~4.000 tokens de classe/chaves (contas, AA, IA, orçamento, notificações) |
| Complemento do string pool | varredura de strings ASCII do `libapp.so` (a cobertura do REA é parcial por design) | os 15 `CREATE TABLE` do SQLite, URLs do backend |
| Assets Flutter | extração do `base.apk` → `assets/flutter_assets` | 26 artigos de ajuda (manual completo do app), traduções `message/*.json`, regras de “notificação → lançamento”, listas de moedas |
| Dependências | `NOTICES.Z` (gzip) | 325 pacotes: `sqflite`, `firebase_*`, `google_mobile_ads`, `in_app_purchase`, `local_auth`, `home_widget`, `speech_to_text`, `excel`, `charts_flutter_new`… |
| Manifest Android | `rea inspect-android-package` | não executado: exige JADX + JDK no host (o próprio REA informa “capability_unavailable”) |
| Validação visual do Cofrinho | `rea capture-browser-scenario` (Playwright + Edge) | 5 cenários, ~220 passos, screenshots de todas as telas principais, zero erros de página |

## 3. Modelo de dados recuperado (SQLite do original) → Cofrinho (IndexedDB)

| Tabela original | Função | No Cofrinho |
|---|---|---|
| `income_expenditure` | lançamentos (valor na moeda do livro, da conta e original; dados de divisão AA; fotos) | `transactions` — mesmos três valores, em **unidades mínimas inteiras** (centavos), sem campos de sincronização |
| `income_expenditure_category` / `_category_new_1` | categorias com `parent_id` (2 níveis), ícone, cor, orçamento | `categories` (orçamento separado em `budgets`) |
| `income_expenditure_account` | contas com moeda própria, saldo inicial, “não somar nos totais” | `accounts` |
| `income_expenditure_budget` | orçamento total (`category_id` nulo) e por categoria | `budgets` |
| `income_expenditure_schedule` | recorrentes: frequência, nº de execuções, última execução, status | `schedules` |
| `income_expenditure_reminder` | lembretes | `reminders` |
| `income_expenditure_suggested_remark` | observações sugeridas por categoria | `notes` |
| `income_expenditure_picture` | fotos dos lançamentos | `photos` (Blob comprimido no próprio aparelho) |
| `income_expenditure_currency` / `_exchange_rate` | moedas e cotações (com cotação personalizada) | `Intl` + `rates` + `customRates` |
| `user_action_log`, `algebraic_average` | atividade de livros AA compartilhados | não necessário (livros locais) |
| `chat_messages`, `user_memory` | assistente de IA na nuvem | não incluído (ver seção 5) |

Todas as tabelas originais têm `is_synchronized`, `is_conflicted` e `server_*_time`, sinal de sincronização com o servidor próprio do desenvolvedor (`money.quhou123.com`). O Cofrinho é local-first: os dados ficam no aparelho, com backup em arquivo.

## 4. Regras de negócio reproduzidas

Extraídas dos artigos de ajuda embutidos no APK (`assets/help/articles/*.md`) e reimplementadas, com testes, em `src/domain`:

- **Recorrentes** (`schedule.ts`): 9 frequências; ocorrências ancoradas na data inicial (dia 31 vira o último dia em meses curtos, sem deriva); executam ao abrir o app e ao voltar para ele, lançando cada data pendente com a própria data; nunca retroagem períodos já encerrados; limite de 0 (sem limite) até 60 execuções, com atalhos 3/6/12/18/24; ao atingir o limite viram “concluído”; mudar frequência, data ou limite recalcula a última execução sem duplicar o dia; nome com até 25 caracteres; transferência com conta apagada é pulada e tentada de novo depois.
- **Orçamento** (`budget.ts`): total mensal e por categoria; se as categorias somarem mais que o total, o total sobe sozinho; o total não pode ficar abaixo da soma das categorias; disponível por dia = restante ÷ dias que faltam.
- **Mês financeiro**: começa em qualquer dia de 1 a 28 (ex.: 26 → de 26 a 25).
- **Contas** (`balances.ts`): saldo = inicial + receitas − despesas ± transferências ± ajustes; cartão de crédito e “a pagar” são passivos; “não somar nos totais” mantém o saldo visível mas fora do patrimônio; o ajuste de saldo gera um lançamento de diferença.
- **Divisão AA** (`split.ts`): igual, por valores, por cotas e por porcentagem, sempre somando exatamente o total (método do maior resto); saldos por membro; dívidas diretas; acerto inteligente com no máximo n−1 pagamentos.
- **Exportação**: Excel, CSV, JSON e HTML, no máximo **1 ano por arquivo**, com os mesmos campos do original (tipo, categoria, subcategoria, membro, observação, valor, moeda, conta, data, fotos).
- **Observação**: até 60 caracteres, com sugestões das mais usadas na categoria.

## 5. Mapa de funcionalidades

| Original | Cofrinho | Observação |
|---|---|---|
| Despesa / receita / transferência, teclado com calculadora (+ − e × ÷), data/hora, conta, fotos, observação | ✅ | |
| Multimoeda com conversão automática e cotação personalizada | ✅ | cotações públicas (currency-api), cache local |
| Subcategorias, ícones e cores | ✅ | ícones Lucide (ISC), não os PNG do original |
| Início: resumo do mês ou acumulado, ocultar valores, troca de mês | ✅ | + deslizar para trocar o mês |
| Calendário com valores diários e orçamento por dia | ✅ | + intensidade de gasto por dia |
| Gráficos por categoria e evolução, ranking, comparação | ✅ | barras no lugar do gráfico de pizza (mais legível) |
| Relatórios anuais, mês a mês | ✅ | + saúde financeira (taxa de poupança) |
| Orçamento total e por categoria, alertas | ✅ | |
| Contas: tipos, padrão, ordenação, excluir dos totais, dívidas (“eu devo / me devem”) | ✅ | |
| Múltiplos livros (pessoal, negócio, projeto) | ✅ | |
| Livro AA (despesas divididas, pagamentos, acerto inteligente) | ✅ | membros locais (sem convite/servidor) |
| Recorrentes | ✅ | |
| Lembretes diários | ✅ | notificações agendadas no Android |
| Busca com filtros | ✅ | + soma dos resultados |
| Exportar | ✅ | |
| Importar extratos (CSV/Excel/JSON) com duplicados | ✅ | sem PDF/imagem (dependiam de IA na nuvem) |
| Temas, modo escuro, ícones mono/coloridos, tamanho do texto | ✅ | todos liberados (sem “premium”) |
| Bloqueio por senha + biometria | ✅ | PIN com PBKDF2; biometria nativa no APK, WebAuthn no navegador |
| Jardim da sorte | ✅ | regras e ilustrações próprias |
| “AI record” (texto/voz) | ✅ adaptado | parser local de linguagem natural (“almoço 32,50 ontem”) + ditado |
| Backup na nuvem / login / multi-dispositivo | ↔ substituído | backup e restauração por arquivo JSON |
| Livros de equipe, compartilhamento familiar | ❌ | exigem servidor próprio |
| Assistente de IA, leitura de recibos por foto, lançamento por notificação | ❌ | dependiam do Gemini/servidor do desenvolvedor |
| Anúncios, assinatura premium, API de desenvolvedor | ❌ | não fazem sentido num app próprio |
| Widget da tela inicial | ❌ | possível no futuro com plugin nativo |

## 6. Limitações da análise

- O código Dart AOT não foi decompilado. Blutter/reFlutter não fazem parte do REA, e o string pool dá contexto suficiente. As regras vêm da documentação embutida e dos esquemas SQL, não da lógica compilada.
- A cobertura do string pool no `inspect-dart-aot` é parcial (o REA declara “class_like_tokens reports 2000 of at least 4000”). A varredura complementar de strings ASCII não captura strings UTF-16.
- O manifest Android não foi decodificado (sem JADX/JDK no momento da análise).
- Comportamentos de servidor (sincronização, convites, IA) só aparecem pelos nomes de chaves e URLs; não houve tráfego de rede capturado.
