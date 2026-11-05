# Reproducibility Guide: Connectra Empirical Evaluation Suite

This guide provides end-to-end instructions for academic reviewers and researchers to reproduce all experimental metrics, tables, and figures reported in the research paper:

> **"Connectra: An AI-Driven and Cybersecurity-Integrated Developer Social Networking Platform"**

---

## 1. Prerequisites & Environment Setup

### 1.1 System Requirements
- **Operating System:** Windows 10/11, Ubuntu 20.04+, or macOS 12+
- **Python Version:** Python 3.9, 3.10, or 3.11
- **Node.js (Optional, for web client):** Node.js v18+ and npm v9+

### 1.2 Python Dependencies
The benchmarking pipeline uses standard scientific packages (`numpy` and `matplotlib`). All networking uses standard library `urllib` to guarantee zero dependency friction.

Install dependencies:
```bash
pip install numpy matplotlib
```

---

## 2. API Key Configuration

The evaluation pipeline performs live inference against Groq Cloud LPUs using the same models configured in Connectra (`qwen/qwen3.8-27b` for the Generator and `openai/gpt-oss-120b` for the Critic).

### Option A: Read from `.env` (Default)
The script automatically searches for `.env` in the repository root and reads `VITE_GROQ_API_KEY`. If your `.env` contains:
```env
VITE_GROQ_API_KEY=gsk_your_groq_api_key_here
```
No further configuration is required.

### Option B: Set Environment Variable
```bash
# Windows PowerShell
$env:VITE_GROQ_API_KEY="gsk_your_groq_api_key_here"

# Linux / macOS Bash
export VITE_GROQ_API_KEY="gsk_your_groq_api_key_here"
```

---

## 3. Running the Complete Benchmarking Suite

Execute the automated research evaluation script from the repository root:

```bash
python research_evaluation/evaluation.py
```

### Execution Log Output
The script will run sequentially through the five experimental tracks:
```text
==============================================================================
CONNECTRA: ACADEMIC RESEARCH BENCHMARKING SUITE
Executing reproducible experimental evaluations across all subsystems...
==============================================================================

[+] Running Experiment 1: LLM-SAST Vulnerability Pipeline Evaluation...
  -> REGEX: P=100.0%, R=80.0%, F1=0.889, Latency=0.09ms
  -> SINGLE_AGENT: P=88.9%, R=80.0%, F1=0.842, Latency=256.41ms
  -> MULTI_AGENT: P=100.0%, R=80.0%, F1=0.889, Latency=731.00ms

[+] Running Experiment 2: Pre-Publish Secret Scanner Evaluation...
  -> REGEX_ONLY: P=100.0%, R=86.7%, F1=0.929, FPR=0.0%, Latency=5.02us
  -> ENTROPY_ONLY_4.2: P=78.6%, R=73.3%, F1=0.759, FPR=20.0%, Latency=49.55us
  -> CONNECTRA_HYBRID: P=93.3%, R=93.3%, F1=0.933, FPR=6.7%, Latency=24.17us

[+] Running Experiment 3: Indirect Prompt Injection Guardrail Evaluation...
  -> GUARDRAILS: Detection Rate=100.0%, Leak Rate=0.0%, F1=1.000, Latency=0.086ms

[+] Running Experiment 4: Hybrid Dense-Sparse RAG Information Retrieval...
  -> BM25 Sparse Only (lambda=1.0): MRR=0.583, P@1=37.5%, NDCG@3=0.641
  -> 32D Dense Only   (lambda=0.0): MRR=0.698, P@1=50.0%, NDCG@3=0.720
  -> Connectra Hybrid (lambda=0.55): MRR=0.677, P@1=50.0%, NDCG@3=0.704

[+] Running Experiment 5: 4D Skill Graph & Team Synergy Matchmaking...
  -> TEAM SYNERGY: Complementary Domain Discovery = 100.0% (vs Jaccard Baseline = 0.0%)
  -> TEAM DOMAIN BALANCE (B_team): Connectra = 59.3% (vs Homogeneous Baseline = 16.7%)
  -> JACCARD UNION PENALTY: Naive Jaccard penalizes security-aware candidates by -37.8% score

[+] Generating IEEE camera-ready figures into research_evaluation/visualizations...
  -> Visualizations saved successfully in PNG and SVG (Figures 1-5).
  -> Exported CSV, JSON, and comparison_tables.md.

==============================================================================
SUCCESS: All experimental benchmarks completed with actual measured data!
Results written to: research_evaluation
==============================================================================
```

---

## 4. Generated Artifacts & Directory Structure

After execution, the following structured artifacts are generated in `research_evaluation/`:

```
research_evaluation/
├── evaluation.py               # Complete executable benchmarking suite
├── experiment_results.csv      # Itemized per-test benchmark records
├── metrics_summary.json        # Machine-readable JSON summary of all metrics
├── comparison_tables.md        # IEEE camera-ready LaTeX & Markdown comparison tables
├── results_analysis.md         # In-depth scientific interpretation and threat validity
├── reproducibility.md          # This reproducibility guide
└── visualizations/             # High-resolution scientific figures (300 DPI PNG & Vector SVG)
    ├── fig1_sast_performance_comparison.png / .svg
    ├── fig2_latency_vs_fpr_tradeoff.png / .svg
    ├── fig3_secret_scanner_comparison.png / .svg
    ├── fig4_rag_hybrid_ablation.png / .svg
    └── fig5_synergy_radar_balance.png / .svg
```

---

## 5. Artifact Inspection & Verification

### 5.1 Inspect Raw CSV Data
```bash
# View summary records
python -c "import pandas as pd; print(pd.read_csv('research_evaluation/experiment_results.csv'))"
```

### 5.2 Verification of Figures
Reviewers can embed the SVG or 300 DPI PNG figures directly into LaTeX documents:
```latex
\begin{figure}[htbp]
  \centering
  \includegraphics[width=\columnwidth]{research_evaluation/visualizations/fig1_sast_performance_comparison.png}
  \caption{Empirical SAST Performance across Architectures.}
  \label{fig:sast_perf}
\end{figure}
```

---

## 6. Determinism & Statistical Replication

- **Experiments 2, 3, 4, and 5** (Secret Scanning, Guardrails, Hybrid RAG, Skill Graph) are **100% deterministic algorithms** executed locally. Their metrics will reproduce identically on every run.
- **Experiment 1** queries live LLM inference with low temperature ($\tau = 0.2$) via the Groq Cloud API. Inference latency will vary slightly based on cloud routing, but accuracy and false-alarm suppression will remain statistically consistent across repeated trials.
