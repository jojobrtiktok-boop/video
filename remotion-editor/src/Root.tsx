import React from 'react';
import { Composition } from 'remotion';
import { VideoComposition } from './compositions/VideoComposition';

export const RemotionRoot: React.FC = () => (
  <Composition
    id="VideoEditor"
    component={VideoComposition}
    durationInFrames={900}
    fps={30}
    width={1920}
    height={1080}
    defaultProps={{ videoSrc: '', scenes: [] }}
  />
);
