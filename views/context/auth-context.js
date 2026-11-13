import { createContext } from 'react';

// Objet de contexte isolé : il n'est pas recréé quand le Provider est rechargé à chaud en développement.
export const AuthContext = createContext(null);
