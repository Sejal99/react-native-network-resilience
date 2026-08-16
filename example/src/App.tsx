import { useEffect, useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Button,
} from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { createNetworkClient } from 'react-native-network-resilience';

const client = createNetworkClient({
  baseURL: 'https://httpstat.us',

  timeout: 5000,

  deduplication: true,

  waitForConnectivity: true,

  connectivityTimeout: 30000,
  onEvent: (event) => {
    console.log('📡 NETWORK EVENT:', event);
  },
});

const App = () => {
  const [networkType, setNetworkType] = useState('Checking...');

  const [isConnected, setIsConnected] = useState<boolean | null>(null);

  const [isReachable, setIsReachable] = useState<boolean | null>(null);

  const [requestStatus, setRequestStatus] = useState('Idle');

  const [response, setResponse] = useState<unknown>(null);

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setNetworkType(state.type);
      setIsConnected(state.isConnected);
      setIsReachable(state.isInternetReachable);
    });

    return unsubscribe;
  }, []);

  const makeRequest = async () => {
    setRequestStatus('Starting request...');
    setResponse(null);
    setError(null);

    try {
      if (!isConnected) {
        setRequestStatus('⏳ Offline — waiting for internet...');
      } else {
        setRequestStatus('🌐 Sending request...');
      }

      const result = await client.get('/500');

      setResponse(result);
      setRequestStatus('✅ Request successful');
    } catch (err: any) {
      console.log('REQUEST ERROR:', err);

      setError(err?.message ?? 'Something went wrong');

      setRequestStatus('❌ Request failed');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Network Resilience</Text>

        {/* NETWORK STATUS */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Network Status</Text>

          <Text style={styles.text}>Type: {networkType}</Text>

          <Text style={styles.text}>
            Connected:{' '}
            {isConnected === null
              ? 'Checking...'
              : isConnected
                ? 'YES ✅'
                : 'NO ❌'}
          </Text>

          <Text style={styles.text}>
            Internet Reachable:{' '}
            {isReachable === null
              ? 'Checking...'
              : isReachable
                ? 'YES ✅'
                : 'NO ❌'}
          </Text>
        </View>

        {/* REQUEST STATUS */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Request Status</Text>

          <Text style={styles.status}>{requestStatus}</Text>
        </View>

        {/* REQUEST BUTTON */}
        <View style={styles.buttonContainer}>
          <Button title="Make Request" onPress={makeRequest} />
        </View>

        {/* RESPONSE */}
        {response !== null && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Response</Text>

            <Text style={styles.response}>
              {JSON.stringify(response, null, 2)}
            </Text>
          </View>
        )}

        {/* ERROR */}
        {error !== null && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Error</Text>

            <Text style={styles.error}>{error}</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  content: {
    padding: 20,
  },

  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 24,
  },

  card: {
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#cccccc',
    borderRadius: 10,
  },

  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },

  text: {
    fontSize: 16,
    marginBottom: 6,
  },

  status: {
    fontSize: 16,
  },

  buttonContainer: {
    marginBottom: 20,
  },

  response: {
    fontSize: 14,
  },

  error: {
    fontSize: 15,
  },
});

export default App;
