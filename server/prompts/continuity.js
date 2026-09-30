export function buildContinuity(previous, shot, characters) {
  return {
    previousShotId: previous?.id || '',
    characterState: characters.map((character) => `${character.name}: ${character.faceDescription}; ${character.clothingDescription}`).join('\n'),
    positionState: previous?.continuityJson || shot.continuityJson || '',
    clothingState: characters.map((character) => `${character.name}: ${character.clothingDescription}`).join('\n'),
    environmentState: shot.continuityJson || '',
    propState: shot.continuityJson || ''
  };
}