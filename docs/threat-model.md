# Segurança

**Português** | [English — detailed reference](./threat-model.en.md)

O servidor controla cartas, apostas e fichas. O nickname é público e a credencial aleatória identifica a sessão. O anfitrião precisa dessa credencial para moderar a sala. Senhas das salas usam salt e PBKDF2.

Mensagens de chat são exibidas como texto e ficam visíveis apenas para participantes autorizados da sala, incluindo espectadores. Limites de frequência e tamanho reduzem abuso. Convites e exportações públicas excluem credenciais e cartas não reveladas. Use HTTPS na publicação e proteja o banco e os backups.
