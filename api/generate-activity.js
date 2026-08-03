} else {
  // Gerador local genérico para qualquer matéria/tema
  obj = [];

  for (let i = 1; i <= Math.max(quantity, 30); i++) {
    obj.push(
      objective(
        `${request.topic} - Questão ${i}`,
        [
          "Alternativa A",
          "Alternativa B",
          "Alternativa C",
          "Alternativa D"
        ],
        "A"
      )
    );
  }

  disc = [];

  for (let i = 1; i <= Math.max(quantity, 30); i++) {
    disc.push(
      discursive(
        `Explique: ${request.topic}.`,
        `Resposta modelo sobre ${request.topic}.`
      )
    );
  }
}
