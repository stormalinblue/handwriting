import React, { useEffect, useRef, useState } from "react";
import './App.css'
import { HandwritingForm } from "./HandwritingPad";


function HandwritingPad() {
  const canvasRef = useRef(null);
  const [prompt, setPrompt] = useState("");
  const [trajectory, setTrajectory] = useState([]);

  // 1) Request prompt from server
  const fetchPrompt = async () => {
    const res = await fetch("http://localhost:5000/prompt");
    const data = await res.json();
    setPrompt(data.prompt);
  };

  useEffect(() => {
    fetchPrompt();
  }, []);

  // 3) Collect trajectory
  useEffect(() => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext("2d");

    const handleDown = (e) => {
      canvas.setPointerCapture(e.pointerId);
      setTrajectory([]);
      record(e);
    };

    const handleMove = (e) => {
      if (e.buttons !== 1) return;
      record(e);
      draw(e);
    };

    // 4) Send dense data to server
    const sendTrajectory = async () => {
      const res = await fetch("http://localhost:5000/trajectory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          trajectory,
        }),
      });
      const data = await res.json();
      console.log("Server response:", data);
    };

    const handleUp = async (e) => {
      canvas.releasePointerCapture(e.pointerId);
      await sendTrajectory();
      await fetchPrompt(); // 6) Ask for new prompt
    };

    const record = (e) => {
      const rect = canvas.getBoundingClientRect();
      setTrajectory((prev) => [
        ...prev,
        {
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
          t: performance.now(),
          pressure: e.pressure,
          tiltX: e.tiltX,
          tiltY: e.tiltY,
          altitudeAngle: e.altitudeAngle,
          azimuthAngle: e.azimuthAngle,
        },
      ]);
    };

    const draw = (e) => {
      ctx.fillStyle = "black";
      ctx.beginPath();
      ctx.arc(
        e.clientX - rect.left,
        e.clientY - rect.top,
        1 + e.pressure * 3,
        0,
        Math.PI * 2
      );
      ctx.fill();
    };

    canvas.addEventListener("pointerdown", handleDown);
    canvas.addEventListener("pointermove", handleMove);
    canvas.addEventListener("pointerup", handleUp);

    return () => {
      canvas.removeEventListener("pointerdown", handleDown);
      canvas.removeEventListener("pointermove", handleMove);
      canvas.removeEventListener("pointerup", handleUp);
    };
  }, [prompt]);



  return (
    <div style={{ padding: 20 }}>
      <h2>Prompt: {prompt}</h2>
      <canvas
        ref={canvasRef}
        width={500}
        height={300}
        style={{
          border: "1px solid black",
          touchAction: "none", // important for stylus
        }}
      />
    </div>
  );
}


function App() {
  return <HandwritingForm prompt={"Hello"} />
  // return <HandwritingPad />
}

export default App
