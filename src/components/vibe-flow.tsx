"use client";

import React, { useEffect, useRef } from 'react';
import { VibeResult, GenerationSet } from '@/app/page';

interface VibeFlowProps {
  generationSets: GenerationSet[];
}

export function VibeFlow({ generationSets }: VibeFlowProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size with more height for better visualization
    canvas.width = window.innerWidth * 0.9;
    canvas.height = Math.max(600, generationSets.length * 200);

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Enhanced styling
    const colors = {
      primary: '#4F46E5',
      secondary: '#6366F1',
      highlight: '#818CF8',
      line: 'rgba(99, 102, 241, 0.6)'
    };

    // Function to draw a node with enhanced styling
    const drawNode = (x: number, y: number, imageUrl: string | null, label: string, isParent: boolean = false) => {
      // Glow effect
      ctx.shadowColor = colors.highlight;
      ctx.shadowBlur = isParent ? 15 : 10;
      
      // Node circle
      ctx.beginPath();
      ctx.arc(x, y, isParent ? 25 : 20, 0, Math.PI * 2);
      ctx.fillStyle = isParent ? colors.primary : colors.secondary;
      ctx.fill();
      ctx.strokeStyle = colors.highlight;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Reset shadow
      ctx.shadowBlur = 0;

      // Draw label
      ctx.fillStyle = '#fff';
      ctx.font = isParent ? '14px sans-serif' : '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(label, x, y + 40);
    };

    // Function to draw a curved connection with arrow
    const drawConnection = (startX: number, startY: number, endX: number, endY: number) => {
      // Draw curved line
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      
      // Calculate control points for a more natural curve
      const midY = (startY + endY) / 2;
      const controlPoint1X = startX;
      const controlPoint1Y = startY + (endY - startY) * 0.2;
      const controlPoint2X = endX;
      const controlPoint2Y = endY - (endY - startY) * 0.2;
      
      ctx.bezierCurveTo(
        controlPoint1X, controlPoint1Y,
        controlPoint2X, controlPoint2Y,
        endX, endY
      );
      
      ctx.strokeStyle = colors.line;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Draw arrow
      const angle = Math.atan2(endY - controlPoint2Y, endX - controlPoint2X);
      const arrowLength = 10;
      
      ctx.beginPath();
      ctx.moveTo(endX, endY);
      ctx.lineTo(
        endX - arrowLength * Math.cos(angle - Math.PI / 6),
        endY - arrowLength * Math.sin(angle - Math.PI / 6)
      );
      ctx.moveTo(endX, endY);
      ctx.lineTo(
        endX - arrowLength * Math.cos(angle + Math.PI / 6),
        endY - arrowLength * Math.sin(angle + Math.PI / 6)
      );
      ctx.strokeStyle = colors.line;
      ctx.lineWidth = 2;
      ctx.stroke();
    };

    // Map to store node positions
    const nodePositions = new Map();

    // Draw nodes and connections with improved layout
    generationSets.forEach((set, setIndex) => {
      const baseY = setIndex * 200 + 100;
      
      // Position parent nodes in a row
      set.vibes.forEach((vibe, vibeIndex) => {
        if (!vibe.parentId) {
          // Calculate x position for original nodes - spread them out in a row
          const x = canvas.width / 2 + (vibeIndex - 1) * 250;
          nodePositions.set(vibe.id, { x, y: baseY });
          drawNode(x, baseY, vibe.imageUrl, vibe.label || `Original ${vibeIndex + 1}`, true);
        }
      });

      // Position and connect variant nodes
      set.vibes.forEach((vibe, vibeIndex) => {
        if (vibe.parentId) {
          const parentPos = nodePositions.get(vibe.parentId);
          if (parentPos) {
            // Position variants in a triangular pattern below parent
            const angle = (vibeIndex * (Math.PI / 2)) - (Math.PI / 4); // Spread across 90 degrees
            const radius = 150;
            const x = parentPos.x + Math.cos(angle) * radius;
            const y = baseY + 150; // Fixed distance below parent
            
            nodePositions.set(vibe.id, { x, y });
            drawConnection(parentPos.x, parentPos.y, x, y);
            drawNode(x, y, vibe.imageUrl, vibe.label || `Variant ${vibeIndex + 1}`);
          }
        }
      });
    });

  }, [generationSets]);

  return (
    <div className="w-full overflow-x-auto bg-black/50 rounded-lg border border-gray-800 p-4">
      <canvas
        ref={canvasRef}
        className="min-w-full"
      />
    </div>
  );
}