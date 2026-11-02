import React from "react";
import { cn } from "../../lib/utills"; // if you use a className utility

interface TaskProgressProps {
  total: number;
  completed: number;
}

export const Progress: React.FC<TaskProgressProps> = ({ total, completed }) => {
  return (
    <div className="flex gap-1 w-full">
      {Array.from({ length: total }).map((_, idx) => (
        <div
          key={idx}
          className={cn(
            "h-2 flex-1 transition-colors duration-300 border skew-x-20 border-soft",
            idx < completed ? "bg-primary" : "bg-surface-secondary"
          )}
        />
      ))}
    </div>
  );
};
