import { useEffect, useState } from "react";

function Cursor() {
    const [cursor, setCursor] = useState({ x: 0, y: 0 });

    useEffect(() => {
        const move = (e) => {
            setCursor({
                x: e.clientX,
                y: e.clientY,
            });
        };

        window.addEventListener("mousemove", move);

        return () => {
            window.removeEventListener("mousemove", move);
        };
    }, []);

    return (
        <div
            className="pointer-events-none fixed z-50 w-10 h-10 rounded-full border-2 border-cyan-300 shadow-[0_0_20px_rgba(0,255,255,0.6)]"
            style={{
                left: cursor.x - 20,
                top: cursor.y - 20,
            }}
        />
    );
}

export default Cursor;