const { sumar, restar, multiplicar, dividir } = require('./math');

describe('Funciones matemáticas', () => {
  test('Suma correctamente dos números', () => {
    expect(sumar(2, 3)).toBe(5);
    expect(sumar(-1, 1)).toBe(0);
  });

  test('Resta correctamente dos números', () => {
    expect(restar(5, 3)).toBe(2);
    expect(restar(10, 7)).toBe(3);
  });

  test('Multiplica correctamente dos números', () => {
    expect(multiplicar(2, 4)).toBe(8);
    expect(multiplicar(-3, 5)).toBe(-15);
  });

  test('Divide correctamente dos números', () => {
    expect(dividir(10, 2)).toBe(5);
  });
});
