import { VMContext } from 'near-sdk-as';
import { Contract } from '../assembly';
import { Game } from '../assembly/game';
import { Unit } from '../assembly/unit';

let contract: Contract;
const P1_ID = 'p1.near';
const P2_ID = 'p2.near';
const units: Unit[] = [
  { unitType: 'samurai' },
  { unitType: 'human' },
  { unitType: 'goblin' },
];
beforeEach(() => {
  contract = new Contract();
  VMContext.setSigner_account_id(P1_ID);
  VMContext.setPredecessor_account_id(P1_ID);
});

const startGame = (contract: Contract): void => {
  contract.createGame(units);
  VMContext.setSigner_account_id(P2_ID);
  VMContext.setPredecessor_account_id(P2_ID);
  contract.joinGame(P1_ID, units);
};

describe('Create and join game', () => {
  it('creates new game', () => {
    contract.createGame(units);
    const game = contract.getGame(P1_ID);
    expect(game.isNull()).toBeFalsy();
    expect(game.p1).toStrictEqual(P1_ID);
    expect(game.p2).toStrictEqual(''); // player 2 not joined yet
    expect(contract.hasPlayer2Joined(P1_ID)).toStrictEqual(false);
  });

  it('cannot cerate game with duplicate units', () => {
    expect(
      contract.createGame([
        { unitType: 'samurai' },
        { unitType: 'samurai' },
        { unitType: 'goblin' },
      ]).code
    ).toBe(4);
  });

  it('cannot cerate game with more or less than 3 units', () => {
    expect(
      contract.createGame([{ unitType: 'human' }, { unitType: 'samurai' }]).code
    ).toBe(3);
    expect(
      contract.createGame([
        { unitType: 'human' },
        { unitType: 'samurai' },
        { unitType: 'goblin' },
        { unitType: 'fish' },
      ]).code
    ).toBe(3);
  });

  it('does not create two games while playing or joining', () => {
    contract.createGame(units);
    const game = contract.getGame(P1_ID);
    contract.createGame(units);
    const game2 = contract.getGame(P1_ID);
    expect(game).toStrictEqual(game2);
  });

  it('creates new game if game is ended', () => {
    contract.createGame(units);
    const game = contract.getGame(P1_ID);
    game.endGame();
    contract.createGame(units);
    const game2 = contract.getGame(P1_ID);
    expect(game).not.toStrictEqual(game2);
  });

  it('cannot join game created by self', () => {
    contract.createGame(units);
    expect(contract.joinGame(P1_ID, units).code).toStrictEqual(1);
    const game = contract.getGame(P1_ID);
    expect(game.p2).toStrictEqual('');
  });

  it('joins existing game', () => {
    startGame(contract);
    const game = contract.getGame(P1_ID);
    expect(game.p2).toStrictEqual(P2_ID);
    expect(contract.hasPlayer2Joined(P1_ID)).toStrictEqual(false); // because p2 cannot ask if p1 has joined, it's given.
    VMContext.setSigner_account_id(P1_ID);
    VMContext.setPredecessor_account_id(P1_ID);
    expect(contract.hasPlayer2Joined(P1_ID)).toStrictEqual(true);
  });

  it('Cannot join ended or game in progress', () => {
    startGame(contract);
    expect(contract.joinGame(P1_ID, units).code).toStrictEqual(2);
    contract.endGame(P1_ID);
    expect(contract.joinGame(P1_ID, units).code).toStrictEqual(5);
  });

  it('Returns initial game data', () => {
    startGame(contract);
    const initialData = contract.getInitialGameData(P1_ID);
    expect(initialData.p1Units).toStrictEqual(units);
    expect(initialData.p2Units).toStrictEqual(units);
  });

  it('Returns game in progress', () => {
    contract.createGame(units);
    expect(contract.isGameInProgress(P1_ID)).toBeFalsy();
    VMContext.setSigner_account_id(P2_ID);
    VMContext.setPredecessor_account_id(P2_ID);
    contract.joinGame(P1_ID, units);
    expect(contract.isGameInProgress(P1_ID)).toBeTruthy();
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

  it('gets a command from other player', () => {
    startGame(contract);
    // p2 commits move
    contract.commitCommands(P1_ID, '{"a":"a"}');
    contract.commitCommands(P1_ID, '{"b":"b"}'); // should not overwrite command
    expect(contract.getOtherPlayerCommands(P1_ID, 0)).toStrictEqual({
      currentTurn: 0,
      p1Turn: 0,
      p2Turn: 1,
      json: '',
    }); // p1 hasn't commited any moves yet
    expect(contract.getOtherPlayerCommands(P1_ID, 1)).toStrictEqual({
      currentTurn: 0,
      p1Turn: 0,
      p2Turn: 1,
      json: '',
    });

    // p1 gets command from p2
    VMContext.setSigner_account_id(P1_ID);
    VMContext.setPredecessor_account_id(P1_ID);
    expect(contract.getOtherPlayerCommands(P1_ID, 0)).toStrictEqual({
      currentTurn: 0,
      p1Turn: 0,
      p2Turn: 1,
      json: '{"a":"a"}',
    });
    expect(contract.getAllCommands(P1_ID)).toStrictEqual({
      p1Commands: [''],
      p2Commands: ['{"a":"a"}', ''],
    }); // p1 hasn't commited any moves yet
  });

  it('gets all commands', () => {
    startGame(contract);
    // p2 commits move
    contract.commitCommands(P1_ID, '{"a":"a"}');
    contract.commitCommands(P1_ID, '{"b":"b"}'); // should not overwrite command
  });

  it('cannot get any commands before player 2 has joined', () => {
    contract.createGame(units);
    expect(contract.getOtherPlayerNextCommands(P1_ID)).toStrictEqual({
      currentTurn: 0,
      p1Turn: 0,
      p2Turn: 0,
      json: '',
    }); // p2 hasn't joined
  });

  it('gets next command from other player', () => {
    startGame(contract);
    // p2 commits move, (p1 has not commited anything)
    contract.commitCommands(P1_ID, '{"a":"a"}');
    contract.commitCommands(P1_ID, '{"b":"b"}'); // should not overwrite command
    expect(contract.getOtherPlayerNextCommands(P1_ID)).toStrictEqual({
      currentTurn: 0,
      p1Turn: 0,
      p2Turn: 1,
      json: '',
    }); // p1 hasn't commited any moves yet, result is '', still waiting for p1's moves
    expect(contract.getOtherPlayerNextCommands(P1_ID)).toStrictEqual({
      currentTurn: 0,
      p1Turn: 0,
      p2Turn: 1,
      json: '',
    });

    // p1 gets command from p2
    VMContext.setSigner_account_id(P1_ID);
    VMContext.setPredecessor_account_id(P1_ID);
    // Cannot get the first commited command by p2, because we are not allowed to poll moves before we have commited our own
    expect(contract.getOtherPlayerNextCommands(P1_ID)).toStrictEqual({
      currentTurn: 0,
      p1Turn: 0,
      p2Turn: 1,
      json: '',
    });
    expect(contract.getOtherPlayerNextCommands(P1_ID)).toStrictEqual({
      currentTurn: 0,
      p1Turn: 0,
      p2Turn: 1,
      json: '',
    });

    // p1 commits move
    const p2CommandsTurn0 = contract.commitCommands(P1_ID, '{"c":"c"}'); // the command will be returned to the client, and the clien't doesn't need to long poll.
    // In the process of comitting own moves a turn has yet to advance
    expect(p2CommandsTurn0).toStrictEqual({
      currentTurn: 0,
      p1Turn: 0,
      p2Turn: 1,
      json: '{"a":"a"}',
    });
    // The turn has now advanced. p1 is allowed to get p2's moves from round 0 as well, but the client need to understand that these commands are now old.
    expect(contract.getOtherPlayerNextCommands(P1_ID)).toStrictEqual({
      currentTurn: 1,
      p1Turn: 1,
      p2Turn: 1,
      json: '{"a":"a"}',
    });
    // p2 gets command from p1
    VMContext.setSigner_account_id(P2_ID);
    VMContext.setPredecessor_account_id(P2_ID);
    // p2 is still longpolling, we need to start the game for p2 too
    expect(contract.getOtherPlayerNextCommands(P1_ID)).toStrictEqual({
      currentTurn: 1,
      p1Turn: 1,
      p2Turn: 1,
      json: '{"c":"c"}',
    });

    contract.commitCommands(P1_ID, '{"d":"d"}'); // will be able to commit move because p2 commited moves first in round 1
    contract.commitCommands(P1_ID, '{"e":"e"}'); // should not overwrite command
    // p2 gets command from p1, but cannot get results before commiting own moves
    VMContext.setSigner_account_id(P2_ID);
    VMContext.setPredecessor_account_id(P2_ID);
    expect(contract.getOtherPlayerNextCommands(P1_ID)).toStrictEqual({
      currentTurn: 1,
      p1Turn: 1,
      p2Turn: 2,
      json: '',
    });
  });
});
