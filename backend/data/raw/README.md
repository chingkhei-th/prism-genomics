# Dataset Download Instructions

Download the following datasets into this directory (`data/raw/`) before running the training pipeline.

## Required Datasets

### 1. ClinVar (Clinical Variant Database)

Provides clinical significance labels (Pathogenic / Benign) for known genetic variants.

```bash
wget -P data/raw/ https://ftp.ncbi.nlm.nih.gov/pub/clinvar/vcf_GRCh38/clinvar.vcf.gz
```

### 2. 1000 Genomes Project (Phase 3)

Provides genotype data from 2,504 human samples. Download one or more chromosomes (`backend/` root directory):

**Chromosome 1** (~1.2 GB — largest chromosome, most variants):
```bash
wget -P data/raw/ https://ftp-trace.ncbi.nih.gov/1000genomes/ftp/release/20130502/ALL.chr1.phase3_shapeit2_mvncall_integrated_v5a.20130502.genotypes.vcf.gz
```

**Chromosome 22** (~200 MB — smallest autosome, good for quick testing):
```bash
wget -P data/raw/ https://ftp-trace.ncbi.nih.gov/1000genomes/ftp/release/20130502/ALL.chr22.phase3_shapeit2_mvncall_integrated_v5a.20130502.genotypes.vcf.gz
```

> **For best model performance**, download both chromosomes. The pipeline will automatically detect and process all `ALL.chr*.vcf.gz` files in this directory.

### Download All at Once

```bash
# Run from the data/raw/ directory
wget https://ftp.ncbi.nlm.nih.gov/pub/clinvar/vcf_GRCh38/clinvar.vcf.gz
wget https://ftp-trace.ncbi.nih.gov/1000genomes/ftp/release/20130502/ALL.chr1.phase3_shapeit2_mvncall_integrated_v5a.20130502.genotypes.vcf.gz
wget https://ftp-trace.ncbi.nih.gov/1000genomes/ftp/release/20130502/ALL.chr22.phase3_shapeit2_mvncall_integrated_v5a.20130502.genotypes.vcf.gz
```

### Optional: Download More Chromosomes

For a whole-genome model, you can download all 22 autosomes:

```bash
for i in $(seq 1 22); do
  wget -P data/raw/ https://ftp-trace.ncbi.nih.gov/1000genomes/ftp/release/20130502/ALL.chr${i}.phase3_shapeit2_mvncall_integrated_v5a.20130502.genotypes.vcf.gz
done
```

## After Downloading

Your `data/raw/` directory should look like:

```
data/raw/
├── clinvar.vcf.gz
├── ALL.chr1.phase3_shapeit2_mvncall_integrated_v5a.20130502.genotypes.vcf.gz
├── ALL.chr22.phase3_shapeit2_mvncall_integrated_v5a.20130502.genotypes.vcf.gz
└── README.md
```

Then run the training pipeline:

```bash
cd backend
uv run python scripts/train.py
```

## Dataset Sources

| Dataset | Source | Reference Build |
|:---|:---|:---|
| ClinVar | [NCBI FTP](https://ftp.ncbi.nlm.nih.gov/pub/clinvar/vcf_GRCh38/) | GRCh38 |
| 1000 Genomes | [EBI FTP](https://ftp.1000genomes.ebi.ac.uk/vol1/ftp/release/20130502/) | GRCh37 |
