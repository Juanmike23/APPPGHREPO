using Microsoft.Data.SqlClient;
using Microsoft.AspNetCore.Mvc;

namespace PGH.Helpers
{
    public static class RequestCancellationHelper
    {
        public static bool IsRequestCanceled(
            ControllerBase controller,
            CancellationToken cancellationToken = default)
        {
            if (cancellationToken.IsCancellationRequested)
            {
                return true;
            }

            var requestAborted = controller.HttpContext?.RequestAborted ?? CancellationToken.None;
            return requestAborted.IsCancellationRequested;
        }

        public static bool IsCanceledSqlException(
            ControllerBase controller,
            SqlException exception,
            CancellationToken cancellationToken = default)
        {
            if (!IsRequestCanceled(controller, cancellationToken))
            {
                return false;
            }

            var message = exception.Message ?? string.Empty;
            return message.Contains("Operation canceled by user", StringComparison.OrdinalIgnoreCase) ||
                   message.Contains("operation was canceled", StringComparison.OrdinalIgnoreCase) ||
                   message.Contains("results, if any, should be discarded", StringComparison.OrdinalIgnoreCase);
        }

        public static bool IsCanceledInvalidOperationException(
            ControllerBase controller,
            InvalidOperationException exception,
            CancellationToken cancellationToken = default)
        {
            if (!IsRequestCanceled(controller, cancellationToken))
            {
                return false;
            }

            var message = exception.Message ?? string.Empty;
            return message.Contains("Operation canceled by user", StringComparison.OrdinalIgnoreCase) ||
                   message.Contains("operation was canceled", StringComparison.OrdinalIgnoreCase);
        }

        public static IActionResult CreateCanceledProblemDetails(
            ControllerBase controller,
            string detail = "Request dibatalkan oleh client.",
            string title = "Request canceled")
        {
            return controller.StatusCode(499, new ProblemDetails
            {
                Status = 499,
                Title = title,
                Detail = detail,
                Type = "https://httpstatuses.com/499",
                Instance = controller.HttpContext?.Request?.Path
            });
        }

        public static Task<IActionResult> ExecuteAsync(
            ControllerBase controller,
            Func<CancellationToken, Task<IActionResult>> action,
            Func<IActionResult> canceledResponseFactory,
            CancellationToken cancellationToken = default,
            Action? onCanceled = null)
        {
            return ExecuteAsyncInternal(
                controller,
                action,
                canceledResponseFactory,
                cancellationToken,
                onCanceled);
        }

        public static async Task<IActionResult> ExecuteAsync(
            ControllerBase controller,
            Func<CancellationToken, Task<IActionResult>> action,
            string message,
            CancellationToken cancellationToken = default)
        {
            return await ExecuteAsyncInternal(
                controller,
                action,
                () => controller.StatusCode(499, new
                {
                    message
                }),
                cancellationToken,
                onCanceled: null);
        }

        private static async Task<IActionResult> ExecuteAsyncInternal(
            ControllerBase controller,
            Func<CancellationToken, Task<IActionResult>> action,
            Func<IActionResult> canceledResponseFactory,
            CancellationToken cancellationToken,
            Action? onCanceled)
        {
            try
            {
                return await action(cancellationToken);
            }
            catch (OperationCanceledException) when (IsRequestCanceled(controller, cancellationToken))
            {
                onCanceled?.Invoke();
                return canceledResponseFactory();
            }
            catch (SqlException ex) when (IsCanceledSqlException(controller, ex, cancellationToken))
            {
                onCanceled?.Invoke();
                return canceledResponseFactory();
            }
            catch (InvalidOperationException ex) when (IsCanceledInvalidOperationException(controller, ex, cancellationToken))
            {
                onCanceled?.Invoke();
                return canceledResponseFactory();
            }
        }
    }
}
