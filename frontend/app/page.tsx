"use client";

import { useState, useEffect } from "react";
import { auth, storage, db } from "./firebase";
import { signInWithPopup, GoogleAuthProvider, signOut, User } from "firebase/auth";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { getFirestore, collection, addDoc, getDocs } from "firebase/firestore"; 

// Definér typen for filer
interface FileData {
  id: string;
  name: string;
  url: string;
  uploadedAt: string;
}

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [files, setFiles] = useState<FileData[]>([]);
  const [question, setQuestion] = useState("");
  const [response, setResponse] = useState("");

  useEffect(() => {
    auth.onAuthStateChanged((currentUser) => {
      setUser(currentUser);
    });

    // Hent filer fra Firestore
    const fetchFiles = async () => {
      const querySnapshot = await getDocs(collection(db, "files"));
      const fileList = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as FileData[];
      setFiles(fileList);
    };

    fetchFiles();
  }, []);

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login fejlede:", error);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setUser(null);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      setFile(event.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      alert("Vælg en fil først.");
      return;
    }

    const fileRef = ref(storage, `uploads/${file.name}`);
    await uploadBytes(fileRef, file);
    const fileURL = await getDownloadURL(fileRef);

    // Gem metadata i Firestore
    const docRef = await addDoc(collection(db, "files"), {
      name: file.name,
      url: fileURL,
      uploadedAt: new Date().toISOString(),
    });

    setFiles([...files, { id: docRef.id, name: file.name, url: fileURL, uploadedAt: new Date().toISOString() }]);
    alert("Fil uploadet!");
  };

  const handleAsk = async () => {
    if (!question.trim()) {
      alert("Skriv et spørgsmål først.");
      return;
    }

    const res = await fetch("http://localhost:5000/ask-ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question }),
    });

    const data = await res.json();
    if (res.ok) {
      setResponse(data.answer);
    } else {
      setResponse("Der opstod en fejl. Prøv igen.");
    }
  };

  return (
    <div style={{ maxWidth: "600px", margin: "50px auto", textAlign: "center" }}>
      {/* Login Sektion */}
      {user ? (
        <>
          <p>Velkommen, {user.displayName}!</p>
          <button onClick={handleLogout}>Log ud</button>
        </>
      ) : (
        <button onClick={handleLogin}>Log ind med Google</button>
      )}

      {/* Filupload Sektion */}
      {user && (
        <>
          <h1>Upload en fil</h1>
          <input type="file" onChange={handleFileChange} />
          <button onClick={handleUpload} style={{ padding: "10px 20px", marginTop: "10px" }}>
            Upload
          </button>

          <h2>Uploadede filer</h2>
          <ul>
            {files.map((file) => (
              <li key={file.id}>
                <a href={file.url} target="_blank" rel="noopener noreferrer">
                  {file.name}
                </a>{" "}
                (Uploadet: {new Date(file.uploadedAt).toLocaleString()})
              </li>
            ))}
          </ul>
        </>
      )}

      {/* AI Spørgsmål Sektion */}
      <h1>Spørg AI'en</h1>
      <input
        type="text"
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder="Skriv dit spørgsmål..."
        style={{ width: "100%", padding: "10px", marginBottom: "10px" }}
      />
      <button onClick={handleAsk} style={{ padding: "10px 20px" }}>
        Spørg
      </button>
      <p style={{ marginTop: "20px" }}>
        <strong>Svar:</strong> {response}
      </p>
    </div>
  );
}
