import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Eye, Settings, Trash2, MoreHorizontal, Github, FolderOpen } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Link } from "wouter";

interface Project {
  id: string;
  name: string;
  github_repo: string | null;
  monitoring_frequency: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  stats?: {
    apiCount: number;
    breakingChanges: number;
    safeChanges: number;
    lastCheck: string | null;
  };
}

interface ProjectsTableProps {
  projects: Project[];
  onDeleteProject: (id: string) => void;
  isDeleting: boolean;
}

export default function ProjectsTable({ projects, onDeleteProject, isDeleting }: ProjectsTableProps) {
  const [deleteProject, setDeleteProject] = useState<Project | null>(null);

  const getStatusBadge = (isActive: boolean) => {
    return isActive ? (
      <Badge className="bg-green-100 text-green-800">
        <div className="w-1.5 h-1.5 bg-green-400 rounded-full mr-1" />
        Active
      </Badge>
    ) : (
      <Badge variant="secondary">
        <div className="w-1.5 h-1.5 bg-gray-400 rounded-full mr-1" />
        Paused
      </Badge>
    );
  };

  const formatTimeAgo = (dateString: string) => {
    return formatDistanceToNow(new Date(dateString), { addSuffix: true });
  };

  // Remove fake data functions - using real data from API

  return (
    <>
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead className="font-medium text-gray-900">Project</TableHead>
                <TableHead className="font-medium text-gray-900">Repository</TableHead>
                <TableHead className="font-medium text-gray-900">APIs</TableHead>
                <TableHead className="font-medium text-gray-900">Status</TableHead>
                <TableHead className="font-medium text-gray-900">Last Check</TableHead>
                <TableHead className="font-medium text-gray-900">Changes</TableHead>
                <TableHead className="text-right font-medium text-gray-900">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {projects.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12">
                    <div className="flex flex-col items-center space-y-3">
                      <FolderOpen className="h-12 w-12 text-gray-400" />
                      <div>
                        <h3 className="text-lg font-medium text-gray-900">No projects found</h3>
                        <p className="text-gray-500">Get started by creating your first API monitoring project.</p>
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                projects.map((project) => {
                  return (
                    <TableRow key={project.id} className="hover:bg-gray-50">
                      <TableCell>
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                            <FolderOpen className="h-5 w-5 text-white" />
                          </div>
                          <div>
                            <div className="font-medium text-gray-900">{project.name}</div>
                            <div className="text-sm text-gray-500">
                              Created {formatTimeAgo(project.created_at)}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        {project.github_repo ? (
                          <div className="flex items-center space-x-2">
                            <Github className="h-4 w-4 text-gray-400" />
                            <span className="text-sm text-gray-900">{project.github_repo}</span>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-500">No repository</span>
                        )}
                      </TableCell>
                      
                      <TableCell>
                        <div>
                          <div className="text-sm text-gray-900">{project.stats?.apiCount || 0} API{(project.stats?.apiCount || 0) === 1 ? '' : 's'}</div>
                          <div className="text-sm text-gray-500">
                            {project.monitoring_frequency} monitoring
                          </div>
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        {getStatusBadge(project.is_active)}
                      </TableCell>
                      
                      <TableCell className="text-sm text-gray-500">
                        {project.stats?.lastCheck ? (
                          <div>
                            <div>{formatTimeAgo(project.stats.lastCheck)}</div>
                            <div className="text-xs text-gray-400">ago</div>
                          </div>
                        ) : (
                          <span className="text-gray-400">Never checked</span>
                        )}
                      </TableCell>
                      
                      <TableCell>
                        <div className="flex space-x-2">
                          {(project.stats?.breakingChanges || 0) > 0 && (
                            <Badge variant="destructive" className="text-xs">
                              {project.stats?.breakingChanges} Breaking
                            </Badge>
                          )}
                          {(project.stats?.safeChanges || 0) > 0 && (
                            <Badge className="bg-green-100 text-green-800 text-xs">
                              {project.stats?.safeChanges} Safe
                            </Badge>
                          )}
                          {(project.stats?.breakingChanges || 0) === 0 && (project.stats?.safeChanges || 0) === 0 && (
                            <span className="text-sm text-gray-500">No changes</span>
                          )}
                        </div>
                      </TableCell>
                      
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link href={`/monitoring?project=${project.id}`}>
                                <Eye className="h-4 w-4 mr-2" />
                                View Details
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Settings className="h-4 w-4 mr-2" />
                              Settings
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-red-600"
                              onClick={() => setDeleteProject(project)}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>

        {/* Pagination */}
        {projects.length > 0 && (
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-500">
                Showing 1 to {projects.length} of {projects.length} projects
              </div>
              <div className="flex items-center space-x-2">
                <Button variant="outline" size="sm" disabled>
                  Previous
                </Button>
                <Button size="sm" className="bg-primary">
                  1
                </Button>
                <Button variant="outline" size="sm" disabled>
                  Next
                </Button>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteProject} onOpenChange={() => setDeleteProject(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Project</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteProject?.name}"? This action cannot be undone.
              All monitoring data and configurations will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteProject) {
                  onDeleteProject(deleteProject.id);
                  setDeleteProject(null);
                }
              }}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? "Deleting..." : "Delete Project"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
