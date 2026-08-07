"use client";
import Link from "next/link";

interface StatCardProps {
  icon: React.ReactNode;
  value: number;
  label: string;
  color: string;
  href?: string;
}

export default function StatCard({ icon, value, label, color, href }: StatCardProps) {
  const content = (
    <div className="stat-card">
      <div className="stat-card-icon" style={{ background: color + "18" }}>
        <span style={{ color }}>{icon}</span>
      </div>
      <div>
        <div className="stat-card-value">{value}</div>
        <div className="stat-card-label">{label}</div>
      </div>
    </div>
  );
  return href ? <Link href={href} style={{ textDecoration: "none" }}>{content}</Link> : content;
}
