/*
 * PGH-DOC
 * File: Mapper/GlobalMappingProfile.cs
 * Apa fungsi bagian ini:
 * - File ini mengatur aturan transformasi object antar model dan DTO.
 * Kenapa perlu:
 * - Perlu agar alur bisnis, keamanan data, dan integrasi antar unit bisa dipelihara tanpa duplikasi logika.
 * Aturan khususnya apa:
 * - Gunakan helper/global engine yang sudah ada; hindari membuat query engine custom per unit.
 * - Perubahan schema wajib lewat sql/migrations dan tercatat di SchemaScriptHistory.
 * - Jaga CreatedAt/UpdatedAt serta validasi akses sesuai role.
 */

using AutoMapper;
using Newtonsoft.Json;
using PGH.Dtos;
using PGH.Dtos.ChangeLog;
using PGH.Dtos.Audit;
using PGH.Dtos.Compliance;
using PGH.Dtos.Human;
using PGH.Dtos.Planing.Realization;
using PGH.Dtos.Preference;
using PGH.Dtos.Procurement;

using PGH.Models;
using PGH.Models.ChangeLog;
using PGH.Models.Audit;
using PGH.Models.Compliance;
using PGH.Models.Human;
using PGH.Models.Planing.Realization;
using PGH.Models.Procurement;
//using refactorbackend.Models.Procurement;
//using WebApplication2.Dtos;



namespace refactorbackend.Mappers
{

    public class ExtraDataConverter : IValueConverter<string?, Dictionary<string, object>?>
    {
        public Dictionary<string, object>? Convert(string? sourceMember, ResolutionContext context)
        {
            if (string.IsNullOrWhiteSpace(sourceMember) || sourceMember == "{}")
                return null;

            try
            {
                return JsonConvert.DeserializeObject<Dictionary<string, object>>(sourceMember);
            }
            catch
            {
                return new Dictionary<string, object> { ["Raw"] = sourceMember };
            }
        }
    }


    public class GlobalMappingProfile : Profile
    {
        public GlobalMappingProfile()
        {
            //---------------------------- GENERIC Mapper --------------------------------------//

            CreateMap<ColumnOrder, ColumnOrderReadDto>().ReverseMap();
            CreateMap<ColumnOrderUpdateDto, ColumnOrder>();


            CreateMap<ChangeLogDto, ChangeLog>();


            //---------------------------- Audit Mapper --------------------------------------//


            CreateMap <CalendarEvents, CalendarEventsReadDto>();
            CreateMap<CalendarEventsCreateDto, CalendarEvents>();

            CreateMap<ListAudit, ListAuditReadDto>()
     .ForMember(dest => dest.ExtraData,
         opt => opt.ConvertUsing(new ExtraDataConverter(), src => src.ExtraData))
           .ForMember(d => d.RHA,
        o => o.MapFrom(s => s.RHA != null && s.RHA.Length > 0))
    .ForMember(d => d.LHA,
        o => o.MapFrom(s => s.LHA != null && s.LHA.Length > 0));


            // (Optional) reverse map so you can save back to DB as string:
            CreateMap<ListAuditReadDto, ListAudit>()
                .ForMember(dest => dest.RHA, opt => opt.Ignore())
                .ForMember(dest => dest.LHA, opt => opt.Ignore())
                .ForMember(dest => dest.CreatedAt, opt => opt.Ignore())
                .ForMember(dest => dest.UpdatedAt, opt => opt.Ignore())
                .ForMember(dest => dest.Id, opt => opt.Ignore())
                .ForMember(dest => dest.ExtraData, opt => opt.MapFrom(src =>
                    src.ExtraData != null ? JsonConvert.SerializeObject(src.ExtraData) : null
                ));

            CreateMap<ListAuditCreateDto, ListAudit>()
                .ForMember(dest => dest.RHA, opt => opt.Ignore())
                .ForMember(dest => dest.LHA, opt => opt.Ignore())
                .ForMember(dest => dest.CreatedAt, opt => opt.Ignore())
                .ForMember(dest => dest.UpdatedAt, opt => opt.Ignore())
                .ForMember(dest => dest.Id, opt => opt.Ignore())
                .ForMember(dest => dest.ExtraData, opt => opt.MapFrom(src =>
                    src.ExtraData != null ? JsonConvert.SerializeObject(src.ExtraData) : null
                ));

            CreateMap<ListAudit, SummaryAuditReadDto>();
            CreateMap<SummaryAuditReadDto, ListAudit>();



            //---------------------------- Compliance Mapper --------------------------------------//

            CreateMap<WeeklyPeriod, WeeklyPeriodDto>();
            CreateMap<WeeklyTableInstance, WeeklyTableInstanceDto>();

            CreateMap<WeeklyTable, WeeklyTableReadDto>()
     .ForMember(dest => dest.ExtraData,
         opt => opt.ConvertUsing(new ExtraDataConverter(), src => src.ExtraData));

            // (Optional) reverse map so you can save back to DB as string:
            CreateMap<WeeklyTableCreateDto, WeeklyTable>()
                .ForMember(dest => dest.ExtraData, opt => opt.MapFrom(src =>
                    src.ExtraData != null ? JsonConvert.SerializeObject(src.ExtraData) : null
                ));


            // ⭐ Mapping for limit endpoint

            CreateMap<DocumentPeriodReportGroup, DocumentPeriodReportGroupDto>();
            CreateMap<DocumentPeriodReport, DocumentPeriodReportReadDto>();
            CreateMap<DocumentPeriodReportCreateDto, DocumentPeriodReport>();



            //---------------------------- PROCUREMENT Mapper ---------------------------------//

            //       CreateMap<APS, APSReadDto>()
            //.ForMember(dest => dest.ExtraData,
            //    opt => opt.ConvertUsing(new ExtraDataConverter(), src => src.ExtraData));

            //       // (Optional) reverse map so you can save back to DB as string:
            //       CreateMap<APSReadDto, APS>()
            //           .ForMember(dest => dest.ExtraData, opt => opt.MapFrom(src =>
            //               src.ExtraData != null ? JsonConvert.SerializeObject(src.ExtraData) : null
            //           ));

            //     CreateMap<AllProcurement, AllProcurementReadDto>()
            //.ForMember(dest => dest.ExtraData,
            //    opt => opt.ConvertUsing(new ExtraDataConverter(), src => src.ExtraData));
            //     CreateMap<AllProcurementCreateDto, AllProcurement>()
            //         .ForMember(dest => dest.ExtraData, opt => opt.MapFrom(src =>
            //             src.ExtraData != null ? JsonConvert.SerializeObject(src.ExtraData) : null
            //         ));





            CreateMap<NewProcure, NewProcureReadDto>();
            CreateMap<NewProcureCreateDto, NewProcure>();

            CreateMap<ExistingProcure, ExistingProcureReadDto>();
            CreateMap<ExistingProcureCreateDto, ExistingProcure>();



            CreateMap<ParentChild, ParentChildReadDto>()
    .ForMember(dest => dest.ChildName, opt => opt.MapFrom(src =>
        src.ChildSource == "NewProcure"
            ? (src.ChildNew != null ? src.ChildNew.Perjanjian : null)
            : (src.ChildExisting != null ? src.ChildExisting.Perjanjian : null)
    ))
    .ForMember(dest => dest.ParentName, opt => opt.MapFrom(src =>
        src.ParentSource == "NewProcure"
            ? (src.ParentNew != null ? src.ParentNew.Perjanjian : null)
            : (src.ParentExisting != null ? src.ParentExisting.Perjanjian : null)
    ));

            CreateMap<SetParentDto, ParentChild>();
            CreateMap<ParentChild, SetParentDto>();



            //---------------------------- PROCUREMENT REMINDER Mapper --------------------------------------//

            CreateMap<NewProcure, ProcureReminderDto>()
                .ForMember(dest => dest.Type, opt => opt.MapFrom(src => "new"))
                .ForMember(dest => dest.SisaBulan, opt => opt.MapFrom(src => CalculateSisaBulan(src.JatuhTempo)))
                .ForMember(dest => dest.DaysRemaining, opt => opt.MapFrom(src => CalculateDaysRemaining(src.JatuhTempo)))
                .ForMember(dest => dest.Countdown, opt => opt.MapFrom(src => BuildCountdown(src.JatuhTempo)))
                .ForMember(dest => dest.Status, opt => opt.MapFrom(src => GetStatus(src.JatuhTempo)))
                .ForMember(dest => dest.ColorCode, opt => opt.MapFrom(src => GetColorCode(src.JatuhTempo)));

            CreateMap<ExistingProcure, ProcureReminderDto>()
                .ForMember(dest => dest.Type, opt => opt.MapFrom(src => "existing"))
                .ForMember(dest => dest.SisaBulan, opt => opt.MapFrom(src => CalculateSisaBulan(src.JatuhTempo)))
                .ForMember(dest => dest.DaysRemaining, opt => opt.MapFrom(src => CalculateDaysRemaining(src.JatuhTempo)))
                .ForMember(dest => dest.Countdown, opt => opt.MapFrom(src => BuildCountdown(src.JatuhTempo)))
                .ForMember(dest => dest.Status, opt => opt.MapFrom(src => GetStatus(src.JatuhTempo)))
                .ForMember(dest => dest.ColorCode, opt => opt.MapFrom(src => GetColorCode(src.JatuhTempo)));






            //CreateMap<APSLogTrail, APSLogTrailReadDto>();

            CreateMap<StatusPengadaan, StatusPengadaanReadDto>()
                     .ForMember(dest => dest.ExtraData,
                         opt => opt.ConvertUsing(new ExtraDataConverter(), src => src.ExtraData));
            CreateMap<StatusPengadaanCreateDto, StatusPengadaan>()
                .ForMember(dest => dest.ExtraData, opt => opt.MapFrom(src =>
                    src.ExtraData != null ? JsonConvert.SerializeObject(src.ExtraData) : null
                ));

            //---------------------------- PLANING Mapper ---------------------------------//

            CreateMap<PlanningDashboardTable, PlanningDashboardTableReadDto>();
            CreateMap<PlanningDashboardTableCreateDto, PlanningDashboardTable>()
                .ForMember(dest => dest.Id, opt => opt.Ignore())
                .ForMember(dest => dest.IsDefault, opt => opt.Ignore())
                .ForMember(dest => dest.CreatedAt, opt => opt.Ignore())
                .ForMember(dest => dest.UpdatedAt, opt => opt.Ignore());

            // Opex Template (new planning tab, isolated from legacy Opex)
            CreateMap<OpexTemplate, OpexTemplateReadDto>();
            CreateMap<OpexTemplateCreateDto, OpexTemplate>();

            // Human_Resource
            CreateMap<FTE, FTEReadDto>();
            CreateMap<FTECreateDto, FTE>();

            CreateMap<NonFTE, NonFTEReadDto>();
            CreateMap<NonFTEReadDto, NonFTE>();

            CreateMap<KebutuhanFTE, KebutuhanFTEReadDto>();
            CreateMap<KebutuhanFTECreateDto, KebutuhanFTE>();




            // Human_Training
            CreateMap<BNU, BNUReadDto>()
            .ForMember(dest => dest.ExtraData,
                opt => opt.ConvertUsing(new ExtraDataConverter(), src => src.ExtraData));
            CreateMap<BNUCreateDto, BNU>()
                .ForMember(dest => dest.ExtraData, opt => opt.MapFrom(src =>
                    src.ExtraData != null ? JsonConvert.SerializeObject(src.ExtraData) : null
                ));


            CreateMap<InternalTraining, InternalTrainingReadDto>()
            .ForMember(dest => dest.ExtraData,
                opt => opt.ConvertUsing(new ExtraDataConverter(), src => src.ExtraData));
            CreateMap<InternalTrainingCreateDto, InternalTraining>()
                .ForMember(dest => dest.ExtraData, opt => opt.MapFrom(src =>
                    src.ExtraData != null ? JsonConvert.SerializeObject(src.ExtraData) : null
                ));


            CreateMap<KompetensiPegawai, KompetensiPegawaiReadDto>()
            .ForMember(dest => dest.ExtraData,
                opt => opt.ConvertUsing(new ExtraDataConverter(), src => src.ExtraData));
            CreateMap<KompetensiPegawaiCreateDto, KompetensiPegawai>()
                .ForMember(dest => dest.ExtraData, opt => opt.MapFrom(src =>
                    src.ExtraData != null ? JsonConvert.SerializeObject(src.ExtraData) : null
                ));




        }



        //---------------------------- PRIVATE HELPERS --------------------------------------//
        //APS REMAINDER HELPERS

        private static int CalculateSisaBulan(DateTime? jatuhTempo)
        {
            if (!jatuhTempo.HasValue) return 0;
            var now = DateTime.UtcNow;
            return ((jatuhTempo.Value.Year - now.Year) * 12) + (jatuhTempo.Value.Month - now.Month);
        }

        private static int CalculateDaysRemaining(DateTime? jatuhTempo)
        {
            if (!jatuhTempo.HasValue) return 0;
            var now = DateTime.UtcNow;
            return (jatuhTempo.Value - now).Days;
        }

        private static string BuildCountdown(DateTime? jatuhTempo)
        {
            if (!jatuhTempo.HasValue) return "No Due Date";

            var now = DateTime.UtcNow;
            var totalDays = (jatuhTempo.Value - now).Days;
            if (totalDays < 0) return "Expired";

            int months = totalDays / 30;
            int days = totalDays % 30;

            return $"{months} month{(months != 1 ? "s" : "")} {days} day{(days != 1 ? "s" : "")} left";
        }

        private static string GetStatus(DateTime? jatuhTempo)
        {
            if (!jatuhTempo.HasValue) return "No Due Date";

            var now = DateTime.UtcNow;
            var totalDays = (jatuhTempo.Value - now).Days;

            return totalDays switch
            {
                < 0 => "Expired",     // overdue
                <= 30 => "Due Soon",    // due very soon
                <= 90 => "Warning",       // next 3 months
                <= 180 => "Info",   // next 6 months
                _ => "success"         // far away / safe
            };
        }
        private static string GetColorCode(DateTime? jatuhTempo)
        {
            if (!jatuhTempo.HasValue)
                return "secondary"; // no due date

            var totalDays = (jatuhTempo.Value.Date - DateTime.UtcNow.Date).Days;

            return totalDays switch
            {
                < 0 => "overdue",     // overdue
                <= 30 => "danger",    // due very soon
                <= 90 => "warning",       // next 3 months
                <= 180 => "info",   // next 6 months
                _ => "success"         // far away / safe
            };
        }

    }

}
