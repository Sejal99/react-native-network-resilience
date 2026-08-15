import React, { useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  Button,
  StyleSheet,
  ScrollView,
} from 'react-native';

import { createNetworkClient } from 'react-native-network-resilience';

const client = createNetworkClient({
  baseURL: 'https://jsonplaceholder.typicode.com',

  retry: {
    maxAttempts: 3,
    backoff: 'exponential',
    initialDelay: 1000,
    maxDelay: 5000,
    jitter: false,
  },

  timeout: 5000,

  deduplication: true,
});

function App() {
  const [loading, setLoading] = useState(false);
  // const [response, setResponse] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  const controllerRef = React.useRef<AbortController | null>(null);

  const cancelRequest = () => {
    controllerRef.current?.abort();
  };
  const makeRequest = async () => {
    setLoading(true);
    // setResponse(null);
    setError(null);

    const controller = new AbortController();

    controllerRef.current = controller;

    try {
      const [result1, result2, result3] = await Promise.all([
        client.get('/todos/1'),
        client.get('/todos/1'),
        client.get('/todos/1'),
      ]);

      console.log('RESULT 1:', result1);
      console.log('RESULT 2:', result2);
      console.log('RESULT 3:', result3);

      // setResponse(result);
    } catch (err) {
      console.error('❌ API ERROR:', err);

      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
      controllerRef.current = null;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Network Resilience</Text>

        <Text style={styles.subtitle}>V1 Core Test</Text>

        <View style={styles.card}>
          <Text style={styles.label}>API</Text>

          <Text style={styles.value}>GET /todos/1</Text>
        </View>

        <View style={styles.buttonContainer}>
          <Button
            title={loading ? 'Requesting...' : 'Make Request'}
            onPress={makeRequest}
            disabled={loading}
          />
        </View>

        {error && (
          <View style={styles.card}>
            <Text style={styles.error}>❌ Request Failed</Text>

            <Text style={styles.result}>{error}</Text>
          </View>
        )}
        <Button
          title="Cancel Request"
          onPress={cancelRequest}
          disabled={!loading}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },

  content: {
    padding: 24,
    paddingTop: 60,
  },

  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
  },

  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 30,
  },

  card: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#f5f5f5',
    marginBottom: 20,
  },

  label: {
    fontSize: 13,
    color: '#666',
    marginBottom: 6,
  },

  value: {
    fontSize: 16,
    fontWeight: '600',
  },

  buttonContainer: {
    marginBottom: 20,
  },

  success: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
  },

  error: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
  },

  result: {
    fontSize: 13,
    lineHeight: 20,
  },
});

export default App;
