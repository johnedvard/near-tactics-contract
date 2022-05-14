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
}
