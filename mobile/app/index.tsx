/**
 * Redirect root to the tabs navigator.
 */
import { Redirect } from 'expo-router';

export default function Index() {
  return <Redirect href="/(tabs)/ask" />;
}
