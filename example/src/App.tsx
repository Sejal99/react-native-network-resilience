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
  baseURL: 'https://jsonplaceholder.typicode.com',

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

  const [events, setEvents] = useState<string[]>([]);

  const [metrics, setMetrics] = useState<any[]>([]);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setNetworkType(state.type);
      setIsConnected(state.isConnected);
      setIsReachable(state.isInternetReachable);
    });

    return unsubscribe;
  }, []);

  const updateEvents = () => {
    const currentMetrics = client.getMetrics();

    setMetrics(currentMetrics);
  };

  const makeRequest = async () => {
    setRequestStatus('Starting request...');
    setResponse(null);
    setError(null);

    setEvents((prev) => [...prev, 'REQUEST BUTTON PRESSED']);

    try {
      if (!isConnected) {
        setRequestStatus('⏳ Offline — waiting for internet...');
      } else {
        setRequestStatus('🌐 Sending request...');
      }

      const result = await client.get('/500');

      setResponse(result);
      setRequestStatus('✅ Request successful');

      updateEvents();
    } catch (err: any) {
      console.log('REQUEST ERROR:', err);

      setError(err?.message ?? 'Something went wrong');

      setRequestStatus('❌ Request failed');

      updateEvents();
    }
  };

  const makeSuccessRequest = async () => {
    setRequestStatus('🌐 Sending request...');
    setResponse(null);
    setError(null);

    try {
      const result = await client.get('/todos/1');

      setResponse(result);
      setRequestStatus('✅ Request successful');

      updateEvents();
    } catch (err: any) {
      setError(err?.message ?? 'Something went wrong');

      setRequestStatus('❌ Request failed');

      updateEvents();
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

        {/* BUTTONS */}

        <View style={styles.buttonContainer}>
          <Button title="Test Retry (500)" onPress={makeRequest} />
        </View>

        <View style={styles.buttonContainer}>
          <Button title="Test Success (200)" onPress={makeSuccessRequest} />
        </View>

        {/* EVENTS */}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Network Events</Text>

          {events.length === 0 ? (
            <Text>No manual events yet</Text>
          ) : (
            events.map((event, index) => (
              <Text key={`${event}-${index}`} style={styles.event}>
                {event}
              </Text>
            ))
          )}
        </View>

        {/* METRICS */}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Request Metrics</Text>

          {metrics.length === 0 ? (
            <Text>No metrics yet</Text>
          ) : (
            metrics.map((metric) => (
              <View key={metric.requestId} style={styles.metric}>
                <Text>Request ID: {metric.requestId}</Text>

                <Text>Duration: {metric.duration} ms</Text>

                <Text>Attempts: {metric.attempts}</Text>

                <Text>Retries: {metric.retries}</Text>

                <Text>Success: {metric.success ? 'YES ✅' : 'NO ❌'}</Text>
              </View>
            ))
          )}
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
    paddingBottom: 40,
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
    fontWeight: '600',
  },

  buttonContainer: {
    marginBottom: 12,
  },

  event: {
    fontSize: 14,
    marginBottom: 5,
  },

  metric: {
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
  },

  response: {
    fontSize: 14,
  },

  error: {
    fontSize: 15,
  },
});

export default App;
