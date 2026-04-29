using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace refactorbackend.Migrations
{
    /// <inheritdoc />
    public partial class InitAuthSchema : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "Procurement");

            migrationBuilder.EnsureSchema(
                name: "Human_Training");

            migrationBuilder.EnsureSchema(
                name: "Planning_Realization");

            migrationBuilder.EnsureSchema(
                name: "Human_Resource");

            migrationBuilder.EnsureSchema(
                name: "Planning_BusinessPlan");

            migrationBuilder.CreateTable(
                name: "APS",
                schema: "Procurement",
                columns: table => new
                {
                    ID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Number = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Status = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    TypeOfProcurement = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    AfterDivision = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Department = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    PIC = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Vendor = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Title = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    ContractValue = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    Term1 = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    WaktuTerm1 = table.Column<DateTime>(type: "datetime2", nullable: true),
                    TypeOfBudget = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    ContractNumber = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    ContractDate = table.Column<DateTime>(type: "datetime2", nullable: true),
                    PKSNumber = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    PKSDate = table.Column<DateTime>(type: "datetime2", nullable: true),
                    SPKNumber = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    SPKDate = table.Column<DateTime>(type: "datetime2", nullable: true),
                    StartDate = table.Column<DateTime>(type: "datetime2", nullable: true),
                    DueDate = table.Column<DateTime>(type: "datetime2", nullable: true),
                    SuratPenetapanPemenang = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    SuratPenunjukanPekerjaan = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    PIC_PFA = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    NoMemoAPSKePFA = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_APS", x => x.ID);
                });

            migrationBuilder.CreateTable(
                name: "BNU",
                schema: "Human_Training",
                columns: table => new
                {
                    ID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    DivisiDepartment = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    UsulanTraining = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    BulanTahun = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    JumlahPerserta = table.Column<int>(type: "int", nullable: true),
                    SentralDesentral = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BNU", x => x.ID);
                });

            migrationBuilder.CreateTable(
                name: "CapexBangunan",
                schema: "Planning_Realization",
                columns: table => new
                {
                    ID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    UnitPengusul = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    SektorPengusul = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    NamaProyek = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    AsetHakGuna = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    KategoriInvestasi = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    NilaiKontrakSPK = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    Q1 = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    Q2 = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    Q3 = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    Q4 = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    Realisasi2025 = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    Realisasi2026 = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    Realisasi2027 = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    Realisasi2028 = table.Column<decimal>(type: "decimal(18,2)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CapexBangunan", x => x.ID);
                });

            migrationBuilder.CreateTable(
                name: "CapexKendaraan",
                schema: "Planning_Realization",
                columns: table => new
                {
                    ID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    UnitPengusul = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    SektorPengusul = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    GroupKP = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    NamaProyek = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    RincianEntitas = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    AsetHakGuna = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    RoadmapInisiative = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Unit = table.Column<int>(type: "int", nullable: true),
                    NilaiKontrakSPK = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    Q1 = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    Q2 = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    Q3 = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    Q4 = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    Realisasi2025 = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    Realisasi2026 = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    Realisasi2027 = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    Realisasi2028 = table.Column<decimal>(type: "decimal(18,2)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CapexKendaraan", x => x.ID);
                });

            migrationBuilder.CreateTable(
                name: "CapexNonOtomasi",
                schema: "Planning_Realization",
                columns: table => new
                {
                    ID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    UnitPengusul = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    SektorPengusul = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    NamaProyek = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    RincianEntitas = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    AsetHakGuna = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Unit = table.Column<int>(type: "int", nullable: true),
                    NilaiKontrakSPK = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    Q1 = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    Q2 = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    Q3 = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    Q4 = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    Realisasi2025 = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    Realisasi2026 = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    Realisasi2027 = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    Realisasi2028 = table.Column<decimal>(type: "decimal(18,2)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CapexNonOtomasi", x => x.ID);
                });

            migrationBuilder.CreateTable(
                name: "CapexOA",
                schema: "Planning_Realization",
                columns: table => new
                {
                    ID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    UnitPengusul = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    SektorPengusul = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    NamaProyek = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    RincianEntitas = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Unit = table.Column<int>(type: "int", nullable: true),
                    NilaiKontrakSPK = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    Q1 = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    Q2 = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    Q3 = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    Q4 = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    Realisasi2025 = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    Realisasi2026 = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    Realisasi2027 = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    Realisasi2028 = table.Column<decimal>(type: "decimal(18,2)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CapexOA", x => x.ID);
                });

            migrationBuilder.CreateTable(
                name: "CapexOtomasi",
                schema: "Planning_Realization",
                columns: table => new
                {
                    ID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    DivisiOwner = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    SektorOwner = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    GroupKP = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    NamaProyek = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    AsetHakGuna = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    NoFS = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    NIlaiKontrakSPK = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    Q1 = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    Q2 = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    Q3 = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    Q4 = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    Realisasi2025 = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    Realisasi2026 = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    Realisasi2027 = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    Realisasi2028 = table.Column<decimal>(type: "decimal(18,2)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CapexOtomasi", x => x.ID);
                });

            migrationBuilder.CreateTable(
                name: "Documents",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    FileName = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    FileContent = table.Column<byte[]>(type: "varbinary(max)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Documents", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "FTE",
                schema: "Human_Resource",
                columns: table => new
                {
                    ID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    NPP = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Nama = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Posisi = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Department = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FTE", x => x.ID);
                });

            migrationBuilder.CreateTable(
                name: "InfoUnit",
                schema: "Planning_BusinessPlan",
                columns: table => new
                {
                    ID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Title = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Description = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_InfoUnit", x => x.ID);
                });

            migrationBuilder.CreateTable(
                name: "Inisiatif",
                schema: "Planning_BusinessPlan",
                columns: table => new
                {
                    ID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Perspektif = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    KodeSaranStrategiBNI = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    InisiatifStrategi = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    KodeSS = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    UIC = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    PerformanceIndicator = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Satuan = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Target2025 = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Q1 = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Q2 = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Q3 = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Q4 = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    PosOpex = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    RpOpex = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    PosCapex = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    RpCapex = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Inisiatif", x => x.ID);
                });

            migrationBuilder.CreateTable(
                name: "InternalTraining",
                schema: "Human_Training",
                columns: table => new
                {
                    ID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    DivisiDepartment = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    UsulanTraining = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    BulanTahun = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    JumlahPerserta = table.Column<int>(type: "int", nullable: true),
                    Biaya = table.Column<decimal>(type: "decimal(18,2)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_InternalTraining", x => x.ID);
                });

            migrationBuilder.CreateTable(
                name: "KebutuhanFTE",
                schema: "Human_Resource",
                columns: table => new
                {
                    ID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Department = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Posisi = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Kebutuhan = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Existing = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Gap = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Keterangan = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_KebutuhanFTE", x => x.ID);
                });

            migrationBuilder.CreateTable(
                name: "KompetensiPegawai",
                schema: "Human_Training",
                columns: table => new
                {
                    ID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    NPP = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Nama = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Department = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    JudulTraining = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    TahunPelaksanaan = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    SertifikasiNonSerifikasi = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_KompetensiPegawai", x => x.ID);
                });

            migrationBuilder.CreateTable(
                name: "ListStrategy",
                schema: "Planning_BusinessPlan",
                columns: table => new
                {
                    ID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ListStrategi = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    DampakFinance = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    ComplexityOfEffort = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    Alignment = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    FinalScore = table.Column<decimal>(type: "decimal(18,2)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ListStrategy", x => x.ID);
                });

            migrationBuilder.CreateTable(
                name: "MapDiagram",
                schema: "Planning_BusinessPlan",
                columns: table => new
                {
                    ID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    UserId = table.Column<int>(type: "int", nullable: true),
                    Name = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Description = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    XmlData = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MapDiagram", x => x.ID);
                });

            migrationBuilder.CreateTable(
                name: "NonFTE",
                schema: "Human_Resource",
                columns: table => new
                {
                    ID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Nama = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    NPP = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    JNKEL = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    MaritalStatus = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    DOB = table.Column<DateTime>(type: "datetime2", nullable: true),
                    FirstDayWork = table.Column<DateTime>(type: "datetime2", nullable: true),
                    EMPCategory = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Job = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Department = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Vendor = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_NonFTE", x => x.ID);
                });

            migrationBuilder.CreateTable(
                name: "Opex",
                schema: "Planning_Realization",
                columns: table => new
                {
                    ID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    MataAnggaran = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Jan = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    Feb = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    Mar = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    Apr = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    May = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    Jun = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    Jul = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    Aug = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    Sep = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    Oct = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    Nov = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    Dec = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    Dec2023 = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    Dec2024 = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    RpGrowth = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    PercentGrowth = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    FullYear = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    YTD = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    toAng2024 = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    toAngYTD2024 = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    SisaAnggaransdFY = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    ParentID = table.Column<int>(type: "int", nullable: true),
                    DataTimeFrom = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Opex", x => x.ID);
                });

            migrationBuilder.CreateTable(
                name: "SDMManPower",
                schema: "Planning_BusinessPlan",
                columns: table => new
                {
                    ID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Positions = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    LevelGrade = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    JumlahKebutuhanWLA = table.Column<int>(type: "int", nullable: true),
                    ExistingPeople = table.Column<int>(type: "int", nullable: true),
                    Gap = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SDMManPower", x => x.ID);
                });

            migrationBuilder.CreateTable(
                name: "SDMPelatihan",
                schema: "Planning_BusinessPlan",
                columns: table => new
                {
                    ID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    TypePlan = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Periode = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    ProposedTraining = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Descriptions = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Timeline = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    RelatedStrategy = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SDMPelatihan", x => x.ID);
                });

            migrationBuilder.CreateTable(
                name: "User",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Email = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    PasswordHash = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Role = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_User", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "UsulanCapex",
                schema: "Planning_BusinessPlan",
                columns: table => new
                {
                    ID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    MataAnggaran = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    TypeAnggaran = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    AnggaranDescription = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Nilai = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    Statuss = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UsulanCapex", x => x.ID);
                });

            migrationBuilder.CreateTable(
                name: "UsulanOpex",
                schema: "Planning_BusinessPlan",
                columns: table => new
                {
                    ID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    MataAnggaran = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    TypeAnggaran = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    AnggaranDescription = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Nilai = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    Statuss = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UsulanOpex", x => x.ID);
                });

            migrationBuilder.CreateTable(
                name: "APSLogtrail",
                schema: "Procurement",
                columns: table => new
                {
                    LogID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    APSID = table.Column<int>(type: "int", nullable: false),
                    ColumnName = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    NewValue = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    OperationType = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    ChangedBy = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    ChangedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_APSLogtrail", x => x.LogID);
                    table.ForeignKey(
                        name: "FK_APSLogtrail_APS_APSID",
                        column: x => x.APSID,
                        principalSchema: "Procurement",
                        principalTable: "APS",
                        principalColumn: "ID",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "StatusPengadaan",
                schema: "Procurement",
                columns: table => new
                {
                    ID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    APSID = table.Column<int>(type: "int", nullable: true),
                    NO = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    AlurPengadaan = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Detail = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Persetujuan = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Status = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    ParentID = table.Column<int>(type: "int", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_StatusPengadaan", x => x.ID);
                    table.ForeignKey(
                        name: "FK_StatusPengadaan_APS_APSID",
                        column: x => x.APSID,
                        principalSchema: "Procurement",
                        principalTable: "APS",
                        principalColumn: "ID");
                    table.ForeignKey(
                        name: "FK_StatusPengadaan_StatusPengadaan_ParentID",
                        column: x => x.ParentID,
                        principalSchema: "Procurement",
                        principalTable: "StatusPengadaan",
                        principalColumn: "ID");
                });

            migrationBuilder.CreateTable(
                name: "HorizontalMatrix",
                schema: "Planning_BusinessPlan",
                columns: table => new
                {
                    ID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    InisiatifID = table.Column<int>(type: "int", nullable: true),
                    KeyIndicator = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Dukungan = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    DivisiService = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    TargetPemenuhanHA = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_HorizontalMatrix", x => x.ID);
                    table.ForeignKey(
                        name: "FK_HorizontalMatrix_Inisiatif_InisiatifID",
                        column: x => x.InisiatifID,
                        principalSchema: "Planning_BusinessPlan",
                        principalTable: "Inisiatif",
                        principalColumn: "ID");
                });

            migrationBuilder.CreateTable(
                name: "PI",
                schema: "Planning_BusinessPlan",
                columns: table => new
                {
                    ID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    InisiatifID = table.Column<int>(type: "int", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PI", x => x.ID);
                    table.ForeignKey(
                        name: "FK_PI_Inisiatif_InisiatifID",
                        column: x => x.InisiatifID,
                        principalSchema: "Planning_BusinessPlan",
                        principalTable: "Inisiatif",
                        principalColumn: "ID");
                });

            migrationBuilder.CreateTable(
                name: "OpexGroup",
                schema: "Planning_Realization",
                columns: table => new
                {
                    ID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    GroupName = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    OpexID = table.Column<int>(type: "int", nullable: false),
                    Sequence = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OpexGroup", x => x.ID);
                    table.ForeignKey(
                        name: "FK_OpexGroup_Opex_OpexID",
                        column: x => x.OpexID,
                        principalSchema: "Planning_Realization",
                        principalTable: "Opex",
                        principalColumn: "ID",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "RefreshTokens",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    UserId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    TokenHash = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    ExpiresAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    IsRevoked = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    RevokedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    ReplacedByTokenHash = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: true),
                    UserAgent = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: true),
                    CreatedByIp = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RefreshTokens", x => x.Id);
                    table.ForeignKey(
                        name: "FK_RefreshTokens_User_UserId",
                        column: x => x.UserId,
                        principalTable: "User",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_APSLogtrail_APSID",
                schema: "Procurement",
                table: "APSLogtrail",
                column: "APSID");

            migrationBuilder.CreateIndex(
                name: "IX_HorizontalMatrix_InisiatifID",
                schema: "Planning_BusinessPlan",
                table: "HorizontalMatrix",
                column: "InisiatifID");

            migrationBuilder.CreateIndex(
                name: "IX_OpexGroup_OpexID",
                schema: "Planning_Realization",
                table: "OpexGroup",
                column: "OpexID");

            migrationBuilder.CreateIndex(
                name: "IX_PI_InisiatifID",
                schema: "Planning_BusinessPlan",
                table: "PI",
                column: "InisiatifID");

            migrationBuilder.CreateIndex(
                name: "IX_RefreshTokens_UserId",
                table: "RefreshTokens",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_StatusPengadaan_APSID",
                schema: "Procurement",
                table: "StatusPengadaan",
                column: "APSID");

            migrationBuilder.CreateIndex(
                name: "IX_StatusPengadaan_ParentID",
                schema: "Procurement",
                table: "StatusPengadaan",
                column: "ParentID");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "APSLogtrail",
                schema: "Procurement");

            migrationBuilder.DropTable(
                name: "BNU",
                schema: "Human_Training");

            migrationBuilder.DropTable(
                name: "CapexBangunan",
                schema: "Planning_Realization");

            migrationBuilder.DropTable(
                name: "CapexKendaraan",
                schema: "Planning_Realization");

            migrationBuilder.DropTable(
                name: "CapexNonOtomasi",
                schema: "Planning_Realization");

            migrationBuilder.DropTable(
                name: "CapexOA",
                schema: "Planning_Realization");

            migrationBuilder.DropTable(
                name: "CapexOtomasi",
                schema: "Planning_Realization");

            migrationBuilder.DropTable(
                name: "Documents");

            migrationBuilder.DropTable(
                name: "FTE",
                schema: "Human_Resource");

            migrationBuilder.DropTable(
                name: "HorizontalMatrix",
                schema: "Planning_BusinessPlan");

            migrationBuilder.DropTable(
                name: "InfoUnit",
                schema: "Planning_BusinessPlan");

            migrationBuilder.DropTable(
                name: "InternalTraining",
                schema: "Human_Training");

            migrationBuilder.DropTable(
                name: "KebutuhanFTE",
                schema: "Human_Resource");

            migrationBuilder.DropTable(
                name: "KompetensiPegawai",
                schema: "Human_Training");

            migrationBuilder.DropTable(
                name: "ListStrategy",
                schema: "Planning_BusinessPlan");

            migrationBuilder.DropTable(
                name: "MapDiagram",
                schema: "Planning_BusinessPlan");

            migrationBuilder.DropTable(
                name: "NonFTE",
                schema: "Human_Resource");

            migrationBuilder.DropTable(
                name: "OpexGroup",
                schema: "Planning_Realization");

            migrationBuilder.DropTable(
                name: "PI",
                schema: "Planning_BusinessPlan");

            migrationBuilder.DropTable(
                name: "RefreshTokens");

            migrationBuilder.DropTable(
                name: "SDMManPower",
                schema: "Planning_BusinessPlan");

            migrationBuilder.DropTable(
                name: "SDMPelatihan",
                schema: "Planning_BusinessPlan");

            migrationBuilder.DropTable(
                name: "StatusPengadaan",
                schema: "Procurement");

            migrationBuilder.DropTable(
                name: "UsulanCapex",
                schema: "Planning_BusinessPlan");

            migrationBuilder.DropTable(
                name: "UsulanOpex",
                schema: "Planning_BusinessPlan");

            migrationBuilder.DropTable(
                name: "Opex",
                schema: "Planning_Realization");

            migrationBuilder.DropTable(
                name: "Inisiatif",
                schema: "Planning_BusinessPlan");

            migrationBuilder.DropTable(
                name: "User");

            migrationBuilder.DropTable(
                name: "APS",
                schema: "Procurement");
        }
    }
}
