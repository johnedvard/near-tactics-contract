import { context, PersistentMap, logging } from 'near-sdk-core';
import { Game } from './game';
import { JOINING, ENDED, PLAYING } from './gameState';

@nearBindgen
export class Contract {
  games: PersistentMap<string, Game> = new PersistentMap<string, Game>('games');

  createGame(): void {
    const existingGame = this.getGame(context.sender);
    if (existingGame.isNull() || existingGame.gameState == ENDED) {
      const game = new Game(context.sender);
      this.games.set(game.gameId, game);
    }
  }

  joinGame(gameId: string): boolean {
    const game: Game = this.getGame(gameId);
    assert(!game.isNull(), 'Game does not exist');
    assert(
      game.p1 != context.sender,
      'Cannot join a game we created ourselves'
    );
    if (game.gameState == PLAYING || game.gameState == ENDED) return false;
    if (game.gameState == JOINING) {
      game.startGame(context.sender);
      this.games.set(game.gameId, game); // Need to actually update the game state to storage
    }
    return true;
  }

  getGame(gameId: string): Game {
    if (this.games.contains(gameId)) {
      return this.games.getSome(gameId);
    }
    return new Game('');
  }

  /**
   * Usually the contract determines the winner and ends the game
   * If a player ends the game, they concede, and automatically loose
   */
  endGame(gameId: string): void {
    const game: Game = this.getGame(gameId);
    assert(!game.isNull(), 'Game does not exist');
    assert(
      game.p1 == context.sender || game.p2 == context.sender,
      'Can only concede own game'
    );
    if (game) {
      game.endGame();
      this.games.set(game.gameId, game); // Need to actually update the game state to storage
    }
  }

  /**
   * The contract remembers the state, and pass it along to the other player after they commit their commands.
   * The client needs to long poll, asking for the other player's next command if this function returns ''.
   * @param json the client state, such as moves and actions
   * @returns {string} the commands from the other player if they commited their commands already.
   */
  commitCommands(gameId: string, json: string): string {
    const game: Game | null = this.getGame(gameId);
    if (!game) return '';
    const turns = this.getPlayerTurns(game);
    const ownTurn = turns[0];
    if (ownTurn == game.currentTurn) {
      // can only commit one command each turn.
      game.storePlayerCommand(context.sender, json);
      game.advancePlayerTurn(context.sender);
      if (game.p1Turn == game.p2Turn) {
        // both players have committed their commands for the round
        game.advanceToNextRound();
        // TODO (johnedvard) return the other player's commited commands
      }
      this.games.set(game.gameId, game); // Need to actually update the game state to storage
    }
    return '';
  }

  /**
   * The client may need to long poll for the commands made by the other player
   * @param gameId
   * @param pTurn the action made on the other players turn
   * @returns
   */
  getOtherPlayersCommand(gameId: string, pTurn: i32): string {
    const game: Game | null = this.getGame(gameId);
    if (!game) return '';
    this.assertOwnGame(
      game,
      'Can only get commands for game we are participating in'
    );
    let otherPlayerCommands: string[] = [];
    if (context.sender == game.p2) otherPlayerCommands = game.p2Commands;
    if (context.sender == game.p1) otherPlayerCommands = game.p1Commands;
    if (otherPlayerCommands.length >= pTurn) return otherPlayerCommands[pTurn];
    return '';
  }

  /**
   *
   * @param game
   * @returns {number[]} always a tuple of two numbers where the first index is our own turn
   */
  private getPlayerTurns(game: Game): number[] {
    this.assertOwnGame(game, 'Can only concede own game');
    let ownTurn = game.p1Turn;
    let otherTurn = game.p2Turn;
    if (context.sender == game.p2) {
      ownTurn = game.p2Turn;
      otherTurn = game.p1Turn;
    }
    return [ownTurn, otherTurn];
  }

  private assertOwnGame(
    game: Game,
    msg: string = 'Can only call functions on a game we are participating in'
  ): void {
    assert(game.p1 == context.sender || game.p2 == context.sender, msg);
  }
}
