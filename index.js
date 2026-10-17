import 'react-native-gesture-handler';
// The rider's background location task must be defined before the app mounts,
// so the OS can run it after a relaunch (services/location/riderLocationTask.ts).
import './src/services/location/riderLocationTask';
import { registerRootComponent } from 'expo';
import App from './App';

registerRootComponent(App);
