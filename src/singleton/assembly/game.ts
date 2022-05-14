import { JOINING, ENDED, PLAYING } from './gameState';

@nearBindgen
export class Game {
  gameId: string = '';
  gameState: string = JOINING;
  p1: string = '';
  p2: string = '';
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
  private setGameState(gameState: string): void {
    this.gameState = gameState;
  }
}
