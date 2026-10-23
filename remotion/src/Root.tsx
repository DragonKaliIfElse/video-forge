import {Composition} from 'remotion';
import {KitDemo} from './KitDemo';
import {Main} from './Main';

export const RemotionRoot: React.FC = () => {
  return (
    <>
    <Composition
      id="Main"
      component={Main}
      durationInFrames={2752}
      fps={30}
      width={1280}
      height={720}
    />
    <Composition
      id="KitDemo"
      component={KitDemo}
      durationInFrames={449}
      fps={30}
      width={1920}
      height={1080}
    />
    </>
  );
};
