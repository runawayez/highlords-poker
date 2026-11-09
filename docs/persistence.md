# Persistência e recuperação

**Português** | [English — detailed reference](./persistence.en.md)

O servidor local usa SQLite com WAL e sincronização FULL. O Worker usa o armazenamento privado do Durable Object. Ambos recuperam o último estado confirmado no início do processo. Uma atualização só é confirmada depois de ser gravada.

O banco contém o baralho e dados privados. Para uma cópia integral, pare o processo ou utilize uma ferramenta de backup online do SQLite que inclua o estado do WAL. Restaure com apenas um processo controlando o banco. A exportação do anfitrião contém o histórico público e as denúncias, e exclui credenciais e cartas ocultas.
