import {
  useEffect,
  useRef,
  useState,
  type PointerEvent,
  useImperativeHandle,
  forwardRef,
} from "react";

import "./HandwritingPad.css";

interface PointerRawUpdateEvent extends PointerEvent {
  getCoalescedEvents: () => Array<PointerEvent>;
}

const sendTrajectory = async (
  prompt_id: string,
  demonstrator_name: string,
  demonstrator_type: string,
  trajectory,
) => {
  const res = await fetch("http://localhost:5000/trajectory", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt_id: prompt_id,
      demo_name: demonstrator_name,
      demo_type: demonstrator_type,
      trajectory: trajectory,
    }),
  });
  const data = await res.json();
  console.log("Server response:", data);
};

const fetchPrompt = async () => {
  const res = await fetch("http://localhost:5000/prompt");
  const data = await res.json();
  return data;
};

export interface HandwritingPadProps {
  accepting: boolean;
  onChangeFilled?: (empty: boolean) => void;
}

const DPR: number = 2;

export const NewHandwritingPad = forwardRef(
  (props: HandwritingPadProps, ref) => {
    const canvasRef = useRef(null);
    const parentRef = useRef(null);

    const trajBuffer = useRef([]);
    const penDown = useRef(false);

    useEffect(() => {
      if (canvasRef.current !== null) {
        const resizer = () => {
          canvasRef.current.width = DPR * canvasRef.current.clientWidth;
          canvasRef.current.height = DPR * canvasRef.current.clientHeight;
        };

        resizer();

        window.addEventListener("resize", resizer);

        return () => {
          window.removeEventListener("resize", resizer);
        };
      }
    }, []);

    const clear = () => {
      penDown.current = false;
      trajBuffer.current = [];

      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      ctx.reset();
    };

    useImperativeHandle(ref, () => ({
      reset() {
        const onChangeFilled = props.onChangeFilled
          ? props.onChangeFilled
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          : (_: boolean) => {};
        if (canvasRef.current !== null) {
          clear();
          onChangeFilled(false);
        }
      },
      getCurrentState() {
        return trajBuffer.current;
      },
    }));

    useEffect(() => {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");

      const onChangeFilled = props.onChangeFilled
        ? props.onChangeFilled
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        : (_: boolean) => {};

      const handleMove = (event: PointerRawUpdateEvent) => {
        const rect = canvas.getBoundingClientRect();
        const events = event.getCoalescedEvents();

        for (const ev of events) {
          const relX = ev.clientX - rect.left;
          const relY = ev.clientY - rect.top;

          // console.log('move to', relX, relY)
          trajBuffer.current.push({
            type: "move",
            x: relX,
            y: relY,
            t: performance.now(),
            pressure: ev.pressure,
            tiltX: ev.tiltX,
            tiltY: ev.tiltY,
            altitudeAngle: ev.altitudeAngle,
            azimuthAngle: ev.azimuthAngle,
          });
        }

        if (penDown.current) {
          for (const ev of events) {
            const relX = ev.clientX - rect.left;
            const relY = ev.clientY - rect.top;

            ctx.lineTo(DPR * relX, DPR * relY);
          }
          ctx.stroke();
        }
      };

      const handleDown = (event: PointerEvent) => {
        penDown.current = true;

        const rect = canvas.getBoundingClientRect();
        const relX = event.clientX - rect.left;
        const relY = event.clientY - rect.top;

        trajBuffer.current.push({
          type: "down",
          x: relX,
          y: relY,
          t: performance.now(),
        });
        ctx.beginPath();
        ctx.lineWidth = DPR;
        ctx.moveTo(DPR * relX, DPR * relY);
        ctx.strokeStyle = "blue";

        onChangeFilled(true);
      };

      const handleUp = (event: PointerEvent) => {
        penDown.current = false;

        const rect = canvas.getBoundingClientRect();
        const relX = event.clientX - rect.left;
        const relY = event.clientY - rect.top;

        trajBuffer.current.push({
          type: "up",
          x: DPR * relX,
          y: DPR * relY,
          t: performance.now(),
        });
      };

      if (props.accepting) {
        canvas.addEventListener("pointerdown", handleDown);
        canvas.addEventListener("pointerup", handleUp);
        canvas.addEventListener("pointerrawupdate", handleMove);

        return () => {
          canvas.removeEventListener("pointerrawupdate", handleMove);
          canvas.removeEventListener("pointerdown", handleDown);
          canvas.removeEventListener("pointerup", handleUp);
        };
      }
    }, [props.accepting, props.onChangeFilled]);

    return (
      <div ref={parentRef} style={{ width: "100%", height: "100%" }}>
        <canvas
          ref={canvasRef}
          style={{
            border: null,
            touchAction: "none", // important for stylus
            width: "100%",
            height: "100%",
          }}
        ></canvas>
      </div>
    );
  },
);

export const HandwritingForm = () => {
  const padRef = useRef(null);
  const nameRef = useRef(null);
  const typeRef = useRef(null);

  const [submitting, setSubmitting] = useState(false);
  const [prompt, setPrompt] = useState(null);
  const [nameFilled, setNameFilled] = useState(false);
  const [typeFilled, setTypeFilled] = useState(false);

  const [canvasFilled, setCanvasFilled] = useState(false);

  const valid = canvasFilled && nameFilled && typeFilled;

  useEffect(() => {
    const getFirstPrompt = async () => {
      setPrompt(await fetchPrompt());
    };

    getFirstPrompt();
  }, []);

  const asyncPart = async () => {
    if (prompt !== null) {
      console.log("submitting");
      const traj = padRef.current.getCurrentState();
      setSubmitting(true);
      padRef.current.reset();
      await sendTrajectory(
        prompt.prompt_id,
        nameRef.current.value,
        typeRef.current.value,
        traj,
      );
      setPrompt(await fetchPrompt());
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (valid && prompt !== null) {
      const asyncPart = async () => {
        console.log("submitting");
        const traj = padRef.current.getCurrentState();
        setSubmitting(true);
        padRef.current.reset();
        await sendTrajectory(
          prompt.prompt_id,
          nameRef.current.value,
          typeRef.current.value,
          traj,
        );
        setPrompt(await fetchPrompt());
        setSubmitting(false);
      };

      const submitHandler = (event: KeyboardEvent) => {
        const tagName: string = event.target.tagName.toLowerCase();
        if (!(tagName === "input" || tagName === "textarea")) {
          if (event.key === "e" || event.key === "E") {
            asyncPart();
          }
        }
      };

      window.addEventListener("keypress", submitHandler);

      return () => {
        window.removeEventListener("keypress", submitHandler);
      };
    }
  }, [submitting, prompt, valid]);

  useEffect(() => {
    const clearHandler = (event: KeyboardEvent) => {
      const tagName: string = event.target.tagName.toLowerCase();
      if (!(tagName === "input" || tagName === "textarea")) {
        if (event.key === "c" || event.key === "C") {
          padRef.current.reset()
        }
      }
    };

    window.addEventListener("keypress", clearHandler)

    return () => {
      window.removeEventListener("keypress", clearHandler);
    };
  })

  const onSubmit = () => {
    console.log("submitting", prompt);
    if (prompt !== null) {
      asyncPart();
    }
  };

  const onClear = () => {
    console.log("clearing", prompt);
    padRef.current.reset();
  };

  if (prompt === null) {
    return <></>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "row", height: "100%" }}>
      <div className="panel" style={{ width: "20%", height: "100%" }}>
        <h1>Write the text into the window to the right</h1>
        <div className="prompt">{prompt.prompt}</div>
        <div className="inputGroup">
          <label htmlFor="demonstrator_name">Name</label>
          <input
            ref={nameRef}
            type="text"
            name="demonstrator_name"
            disabled={submitting}
            onChange={(ev) => {
              setNameFilled(ev.target.value.trim().length > 0);
            }}
          ></input>
        </div>
        <div className="inputGroup">
          <label htmlFor="demonstrator_type">Type</label>
          <input
            ref={typeRef}
            type="text"
            name="demonstrator_type"
            disabled={submitting}
            onChange={(ev) => {
              setTypeFilled(ev.target.value.trim().length > 0);
            }}
          ></input>
        </div>
        <div className="buttonGroup">
          <button onClick={onClear} disabled={submitting}>
            Clear (or press C)
          </button>
          <button onClick={onSubmit} disabled={submitting || !valid}>
            Submit (or press E)
          </button>
        </div>
      </div>
      <div style={{ width: "80%", height: "100%" }}>
        <NewHandwritingPad
          ref={padRef}
          accepting={!submitting}
          onChangeFilled={(filled) => {setCanvasFilled(filled)}}
        />
      </div>
    </div>
  );
};
