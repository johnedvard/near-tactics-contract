import { JOINING, ENDED, PLAYING } from './gameState';

@nearBindgen
export class Game {
  gameId: string = '';
  gameState: string = JOINING;
  p1: string = '';
  p2: string = '';
  p1Turn: i32 = 0;
  p2Turn: i32 = 0;
  currentTurn: i32 = 0;
  p1Commands: string[] = ['']; // each position represents the commands for the given turn (pos 0 for p1Turn=0, pos 1 fo p1Turn=1)
  p2Commands: string[] = [''];

  constructor(p1: string) {
    this.gameId = p1; // TODO (johnedvard) make it possible to have more than one game
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

  storePlayerCommand(playerId: string, json: string): void {
    let pCommands = this.p1Commands;
    let pTurn = this.p1Turn;
    if (playerId == this.p2) {
      pCommands = this.p2Commands;
      pTurn = this.p2Turn;
    }
    // Do not overwrite existing commands
    if (!pCommands[pTurn]) {
      pCommands[pTurn] = json;
      pCommands.push('');
    }
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
