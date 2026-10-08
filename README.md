# FlowDock: prova de conceito

Reordena a fila de caminhões automaticamente pelo ETA e compara com uma agenda estática.
Módulo JavaScript puro, sem backend, com dados simulados.

## Como executar (Node.js 18 ou superior)
node fila_dinamica.js            # roda os 3 cenários
node fila_dinamica.js --pausar   # espera ENTER entre cenários
node fila_dinamica.js --testar   # verificações automáticas

## Cenários
1. O caminhão A atrasa 1h30: B e C avançam.
2. Quem chega fora da janela não passa na frente de quem chegou no prazo.
3. Certificado vencido bloqueia o agendamento de carga perigosa.
