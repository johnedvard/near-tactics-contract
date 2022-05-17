import { VMContext } from 'near-sdk-as';
import { Contract } from '../assembly';
import { Game } from '../assembly/game';

let contract: Contract;
const P1_ID = 'p1.near';
const P2_ID = 'p2.near';
beforeEach(() => {
  contract = new Contract();
  VMContext.setSigner_account_id(P1_ID);
  VMContext.setPredecessor_account_id(P1_ID);
});

const startGame = (contract: Contract): void => {
  contract.createGame();
  VMContext.setSigner_account_id(P2_ID);
  VMContext.setPredecessor_account_id(P2_ID);
  contract.joinGame(P1_ID);
};

describe('Create and join game', () => {
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
    startGame(contract);
    const game = contract.getGame(P1_ID);
    expect(game.p2).toStrictEqual(P2_ID);
  });

  it('Cannot join ended or game in progress', () => {
    startGame(contract);
    expect(contract.joinGame(P1_ID)).toBeFalsy();
    contract.endGame(P1_ID);
    expect(contract.joinGame(P1_ID)).toBeFalsy();
  });
});

describe('Take turns', () => {
  it('Sets start turn correctly', () => {
    startGame(contract);
    const game: Game = contract.getGame(P1_ID);
    expect(game.p1Turn).toStrictEqual(0);
    expect(game.p2Turn).toStrictEqual(0);
    expect(game.currentTurn).toStrictEqual(0);
  });

  it('Advance to next round p2 first', () => {
    startGame(contract);

    // p2 commits move
    contract.commitCommands(P1_ID, '');
    contract.commitCommands(P1_ID, ''); // should not increase player turn
    let game: Game = contract.getGame(P1_ID);
    expect(game.p1Turn).toStrictEqual(0);
    expect(game.p2Turn).toStrictEqual(1);
    expect(game.currentTurn).toStrictEqual(0);

    // p1 commits move
    VMContext.setSigner_account_id(P1_ID);
    VMContext.setPredecessor_account_id(P1_ID);
    contract.commitCommands(P1_ID, '');
    game = contract.getGame(P1_ID);
    expect(game.p2Turn).toStrictEqual(1);
    expect(game.p1Turn).toStrictEqual(1);
    expect(game.currentTurn).toStrictEqual(1);
  });

  it('Advance to next round p1 first', () => {
    startGame(contract);

    // p1 commits move
    VMContext.setSigner_account_id(P1_ID);
    VMContext.setPredecessor_account_id(P1_ID);
    contract.commitCommands(P1_ID, '');
    contract.commitCommands(P1_ID, ''); // should not increase player turn
    let game: Game = contract.getGame(P1_ID);
    expect(game.p1Turn).toStrictEqual(1);
    expect(game.p2Turn).toStrictEqual(0);
    expect(game.currentTurn).toStrictEqual(0);

    // p2 commits move
    VMContext.setSigner_account_id(P2_ID);
    VMContext.setPredecessor_account_id(P2_ID);
    contract.commitCommands(P1_ID, '');
    game = contract.getGame(P1_ID);
    expect(game.p1Turn).toStrictEqual(1);
    expect(game.p2Turn).toStrictEqual(1);
    expect(game.currentTurn).toStrictEqual(1);
  });
});

describe('Store commands', () => {
  it('Stores command after taking turn', () => {
    startGame(contract);
    // p2 commits move
    contract.commitCommands(P1_ID, '{"a":"a"}');
    contract.commitCommands(P1_ID, '{"b":"b"}'); // should not overwrite command
    let game: Game = contract.getGame(P1_ID);
    expect(game.p2Commands[0]).toStrictEqual('{"a":"a"}');
    expect(game.p2Commands[1]).toStrictEqual('');
    expect(game.p2Commands.length).toStrictEqual(2);
    expect(game.p1Commands[0]).toStrictEqual('');
    expect(game.p1Commands.length).toStrictEqual(1);

    // p1 commits move
    VMContext.setSigner_account_id(P1_ID);
    VMContext.setPredecessor_account_id(P1_ID);
    contract.commitCommands(P1_ID, '{"c":"c"}');
    contract.commitCommands(P1_ID, '{"d":"d"}'); // will be able to commit move because p1 commited moves first in round 1
    contract.commitCommands(P1_ID, '{"e":"e"}'); // should not overwrite command
    game = contract.getGame(P1_ID);
    expect(game.p1Commands[0]).toStrictEqual('{"c":"c"}');
    expect(game.p1Commands[1]).toStrictEqual('{"d":"d"}');
    expect(game.p1Commands[2]).toStrictEqual('');
    expect(game.p1Commands.length).toStrictEqual(3);
    expect(game.p2Commands.length).toStrictEqual(2);
  });
});
