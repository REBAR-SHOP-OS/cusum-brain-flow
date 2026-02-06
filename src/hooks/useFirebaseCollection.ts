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
export interface FirebaseJob {
  id: string;
  [key: string]: unknown;
}

export interface FirebaseLocation {
  id: string;
  [key: string]: unknown;
}

export interface FirebaseMachine {
  id: string;
  [key: string]: unknown;
}

export interface FirebaseProject {
  id: string;
  [key: string]: unknown;
}

export interface FirebaseQueue {
  id: string;
  [key: string]: unknown;
}

export interface FirebaseRole {
  id: string;
  [key: string]: unknown;
}

export interface FirebaseUser {
  id: string;
  [key: string]: unknown;
}

export const useJobs = () => useFirebaseCollection<FirebaseJob>("jobs");
export const useLocations = () => useFirebaseCollection<FirebaseLocation>("locations");
export const useMachines = () => useFirebaseCollection<FirebaseMachine>("machines");
export const useProjects = () => useFirebaseCollection<FirebaseProject>("projects");
export const useQueues = () => useFirebaseCollection<FirebaseQueue>("queues");
export const useRoles = () => useFirebaseCollection<FirebaseRole>("roles");
export const useFirebaseUsers = () => useFirebaseCollection<FirebaseUser>("users");
