import { JOINING, ENDED, PLAYING } from './gameState';

@nearBindgen
export class Game {
  gameId: string = '';
  gameState: string = JOINING;
  p1: string = '';
  p2: string = '';
  p1Turn: number = 0;
  p2Turn: number = 0;
  currentTurn: number = 0;

  constructor(p1: string) {
    this.gameId = p1; // TODO (johnedvard) make it possible to have more than one
    this.p1 = p1;
  }

  startGame(p2: string): void {
    this.p2 = p2;
    this.setGameState(PLAYING);
  }

  endGame(): void {
    this.setGameState(ENDED);
  }

  isNull(): boolean {
    return this.gameId == '';
  }

  advancePlayerTurn(playerId: string): void {
    if (playerId == this.p1) this.p1Turn++;
    if (playerId == this.p2) this.p2Turn++;
  }

  /**
   * Increase the currentTurn in the game
   * @returns {number} the current round (after advancing to the next round)
   */
  advanceToNextRound(): number {
    if (this.p1Turn == this.p2Turn) this.currentTurn++;
    return this.currentTurn;
  }

  private setGameState(gameState: string): void {
    this.gameState = gameState;
  }
}
