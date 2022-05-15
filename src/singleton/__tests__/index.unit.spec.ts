import { VMContext } from 'near-sdk-as';
import { Contract } from '../assembly';

let contract: Contract;
const P1_ID = 'p1.near';
const P2_ID = 'p2.near';
beforeEach(() => {
  contract = new Contract();
  VMContext.setSigner_account_id(P1_ID);
  VMContext.setPredecessor_account_id(P1_ID);
});

describe('Game Logic', () => {
  it('creates new game', () => {
    contract.createGame();
    const game = contract.getGame(P1_ID);
    expect(game.isNull()).toBeFalsy();
    expect(game.p1).toStrictEqual(P1_ID);
    expect(game.p2).toStrictEqual(''); // player 2 not joined yet
  });

  it('does not create two games while playing or joining', () => {
    contract.createGame();
    const game = contract.getGame(P1_ID);
    contract.createGame();
    const game2 = contract.getGame(P1_ID);
    expect(game).toStrictEqual(game2);
  });

  it('creates new game if game is ended', () => {
    contract.createGame();
    const game = contract.getGame(P1_ID);
    game.endGame();
    contract.createGame();
    const game2 = contract.getGame(P1_ID);
    expect(game).not.toStrictEqual(game2);
  });

  it('joins existing game', () => {
    contract.createGame();
    VMContext.setSigner_account_id(P2_ID);
    VMContext.setPredecessor_account_id(P2_ID);
    contract.joinGame(P1_ID);
    const game = contract.getGame(P1_ID);
    expect(game.p2).toStrictEqual(P2_ID);
  });

  it('Cannot join ended or game in progress', () => {
    contract.createGame();
    VMContext.setSigner_account_id(P2_ID);
    VMContext.setPredecessor_account_id(P2_ID);
    contract.joinGame(P1_ID);
    expect(contract.joinGame(P1_ID)).toBeFalsy();
    contract.endGame(P1_ID);
    expect(contract.joinGame(P1_ID)).toBeFalsy();
  });
});
