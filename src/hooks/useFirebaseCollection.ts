import { useEffect, useState } from "react";
import { collection, onSnapshot, query, QueryConstraint, DocumentData } from "firebase/firestore";
import { db } from "@/lib/firebase";

const COMPANY_PATH = "companies/rebar-shop";

export function useFirebaseCollection<T = DocumentData>(
  collectionName: string,
  queryConstraints: QueryConstraint[] = []
) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const collectionRef = collection(db, `${COMPANY_PATH}/${collectionName}`);
    const q = query(collectionRef, ...queryConstraints);

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const docs = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as T[];
        setData(docs);
        setLoading(false);
      },
      (err) => {
        console.error(`Firebase error fetching ${collectionName}:`, err);
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [collectionName, JSON.stringify(queryConstraints)]);

  return { data, loading, error };
}

// Typed hooks for specific collections
export interface FirebaseDocument {
  id: string;
  [key: string]: unknown;
}

// All Firebase collections under companies/rebar-shop/
export const useBrain = () => useFirebaseCollection<FirebaseDocument>("brain");
export const useFirebaseCommunications = () => useFirebaseCollection<FirebaseDocument>("communications");
export const useFirebaseCustomers = () => useFirebaseCollection<FirebaseDocument>("customers");
export const useFirebaseEvents = () => useFirebaseCollection<FirebaseDocument>("events");
export const useFirebaseIntegrations = () => useFirebaseCollection<FirebaseDocument>("integrations");
export const useJobs = () => useFirebaseCollection<FirebaseDocument>("jobs");
export const useKnowledge = () => useFirebaseCollection<FirebaseDocument>("knowledge");
export const useLocations = () => useFirebaseCollection<FirebaseDocument>("locations");
export const useMachines = () => useFirebaseCollection<FirebaseDocument>("machines");
export const useProjects = () => useFirebaseCollection<FirebaseDocument>("projects");
export const useQueues = () => useFirebaseCollection<FirebaseDocument>("queues");
export const useRoles = () => useFirebaseCollection<FirebaseDocument>("roles");
export const useTasks = () => useFirebaseCollection<FirebaseDocument>("tasks");
export const useFirebaseUsers = () => useFirebaseCollection<FirebaseDocument>("users");
