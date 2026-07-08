import { Link } from "react-router-dom";

const NotFound = () => {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted px-4">
      <div className="w-full max-w-md rounded-2xl bg-card p-8 text-center shadow-lg">
        <p className="mb-2 text-5xl font-bold text-primary">404</p>
        <h1 className="mb-3 text-xl font-semibold text-foreground">Page not found</h1>
        <p className="mb-6 text-muted-foreground">
          The page you are looking for does not exist or may have been moved.
        </p>
        <Link
          to="/"
          className="inline-flex items-center justify-center rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        >
          Return home
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
